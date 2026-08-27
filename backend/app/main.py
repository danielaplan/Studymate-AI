"""
StudyMate AI — FastAPI Application
Full RAG pipeline endpoints:
  POST /api/subjects              — create a subject
  GET  /api/subjects              — list all subjects
  DELETE /api/subjects/{id}       — delete a subject
  POST /api/subjects/{id}/upload  — upload PDF/image, run OCR → chunk → embed
  GET  /api/subjects/{id}/materials — list materials for a subject
  DELETE /api/materials/{id}      — delete a material
  POST /api/chat                  — RAG-grounded chat
  POST /api/subjects/{id}/summary — generate AI summary
  POST /api/subjects/{id}/quiz    — generate quiz questions
  POST /api/subjects/{id}/flashcards — generate flashcards
  GET  /api/subjects/{id}/quiz    — retrieve stored quiz questions
  GET  /api/subjects/{id}/flashcards — retrieve stored flashcards
  GET  /api/subjects/{id}/chat-history — retrieve chat history
  GET  /health                    — health check
  POST /api/test-pipeline         — legacy test endpoint
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional

import aiofiles
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import (
    ChatMessage,
    Flashcard,
    Material,
    QuizQuestion,
    Subject,
    TextChunk,
    get_db,
    init_db,
)
from .document_processor import (
    chunk_text,
    clean_text,
    delete_material_chunks,
    extract_text,
    retrieve_relevant_chunks,
    store_chunks_in_vector_db,
)
from .gemini import GeminiService

logger = logging.getLogger(__name__)

settings = get_settings()
gemini_service = GeminiService(settings)

UPLOADS_DIR = Path(__file__).parent.parent.parent / "database" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_EXTENSIONS = {
    "pdf", "docx", "pptx", "xlsx", "xls", "txt", "md", "csv", "json", "xml",
    "html", "htm", "log", "yaml", "yml", "jpg", "jpeg", "png", "tiff", "tif",
    "bmp", "webp", "gif", "heic", "heif",
}
MAX_UPLOAD_SIZE = 50 * 1024 * 1024

app = FastAPI(title="StudyMate AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    await init_db()
    logger.info("StudyMate AI backend started. DB initialised.")


# ===========================================================================
# SUBJECTS
# ===========================================================================

class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    color_tag: Optional[str] = "#334F2B"


class SubjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    color_tag: Optional[str]
    materials_count: int = 0
    mastery: float = 0.0

    class Config:
        from_attributes = True


@app.get("/api/subjects", response_model=List[SubjectResponse])
async def list_subjects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject))
    subjects = result.scalars().all()
    out = []
    for s in subjects:
        mats = await db.execute(select(Material).where(Material.subject_id == s.id))
        mat_count = len(mats.scalars().all())

        fc_result = await db.execute(select(Flashcard).where(Flashcard.subject_id == s.id))
        flashcards = fc_result.scalars().all()
        mastery = 0.0
        if flashcards:
            mastery = round(sum(f.mastery_score for f in flashcards) / len(flashcards) * 100, 1)

        out.append(SubjectResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            color_tag=s.color_tag,
            materials_count=mat_count,
            mastery=mastery,
        ))
    return out


@app.post("/api/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def create_subject(body: SubjectCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Subject).where(Subject.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A subject with this name already exists.")
    subject = Subject(name=body.name, description=body.description, color_tag=body.color_tag)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return SubjectResponse(id=subject.id, name=subject.name, description=subject.description, color_tag=subject.color_tag)


@app.delete("/api/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(subject_id: int, db: AsyncSession = Depends(get_db)):
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    await db.delete(subject)
    await db.commit()


# ===========================================================================
# MATERIALS — Upload, Process, List, Delete
# ===========================================================================

class MaterialResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    file_size_bytes: Optional[int]
    processing_status: str
    chunks_count: int = 0

    class Config:
        from_attributes = True


@app.post("/api/subjects/{subject_id}/upload", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
async def upload_material(
    subject_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a supported study file and run extraction, chunking, and indexing."""
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    # Determine file type
    fname = file.filename or "upload"
    ext = Path(fname).suffix.lower().lstrip(".")
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload a document, spreadsheet, presentation, text file, PDF, or image.")
    if ext in {"jpg", "jpeg", "png", "tiff", "tif", "bmp", "webp", "gif", "heic", "heif"}:
        file_type = "image"
    else:
        file_type = ext

    file_bytes = await file.read()
    file_size = len(file_bytes)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if file_size > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File is too large. Maximum upload size is 50 MB.")

    # Save file to disk
    saved_name = f"{uuid.uuid4().hex}_{fname}"
    save_path = UPLOADS_DIR / saved_name
    async with aiofiles.open(save_path, "wb") as f:
        await f.write(file_bytes)

    # Create material record
    material = Material(
        subject_id=subject_id,
        filename=fname,
        file_path=str(save_path),
        file_type=file_type,
        file_size_bytes=file_size,
        processing_status="processing",
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)

    # --- Run Processing Pipeline ---
    try:
        # 1. Extract text
        raw_text = extract_text(file_bytes, file_type)
        material.extracted_text = clean_text(raw_text)

        # 2. Chunk the text
        chunks = chunk_text(material.extracted_text or "")

        # 3. Store chunks in DB
        chunk_objs = []
        for i, chunk_content in enumerate(chunks):
            chunk_objs.append(TextChunk(
                material_id=material.id,
                chunk_index=i,
                content=chunk_content,
            ))
        db.add_all(chunk_objs)
        await db.commit()

        # 4. Store embeddings in ChromaDB
        if chunks:
            chroma_ids = store_chunks_in_vector_db(chunks, material.id, subject_id)
            for i, chunk_obj in enumerate(chunk_objs):
                chunk_obj.chroma_id = chroma_ids[i] if i < len(chroma_ids) else None
            await db.commit()

        material.processing_status = "done"
        await db.commit()
    except Exception as e:
        logger.error(f"Processing pipeline failed for material {material.id}: {e}")
        material.processing_status = "failed"
        await db.commit()

    chunks_result = await db.execute(select(TextChunk).where(TextChunk.material_id == material.id))
    chunks_count = len(chunks_result.scalars().all())

    return MaterialResponse(
        id=material.id,
        filename=material.filename,
        file_type=material.file_type,
        file_size_bytes=material.file_size_bytes,
        processing_status=material.processing_status,
        chunks_count=chunks_count,
    )


@app.get("/api/subjects/{subject_id}/materials", response_model=List[MaterialResponse])
async def list_materials(subject_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Material).where(Material.subject_id == subject_id))
    materials = result.scalars().all()
    out = []
    for m in materials:
        chunks_result = await db.execute(select(TextChunk).where(TextChunk.material_id == m.id))
        chunks_count = len(chunks_result.scalars().all())
        out.append(MaterialResponse(
            id=m.id, filename=m.filename, file_type=m.file_type,
            file_size_bytes=m.file_size_bytes, processing_status=m.processing_status,
            chunks_count=chunks_count,
        ))
    return out


@app.delete("/api/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material(material_id: int, db: AsyncSession = Depends(get_db)):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found.")
    delete_material_chunks(material_id)  # Remove from ChromaDB
    # Remove file from disk
    try:
        Path(material.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    await db.delete(material)
    await db.commit()


# ===========================================================================
# RAG CHAT
# ===========================================================================

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    subject_id: Optional[int] = None


class ChatResponse(BaseModel):
    reply: str
    retrieved_chunks_count: int
    provider: str


@app.post("/api/chat", response_model=ChatResponse)
async def rag_chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    """RAG-grounded chat: retrieves relevant study chunks then answers via Gemini."""
    subject_name = None
    if body.subject_id:
        subject = await db.get(Subject, body.subject_id)
        if subject:
            subject_name = subject.name

    # Load all chunks for this subject from DB as fallback
    fallback_chunks = []
    if body.subject_id:
        db_chunks_res = await db.execute(
            select(TextChunk.content)
            .join(Material, TextChunk.material_id == Material.id)
            .where(Material.subject_id == body.subject_id)
        )
        fallback_chunks = [c[0] for c in db_chunks_res.all()]
    else:
        db_chunks_res = await db.execute(select(TextChunk.content))
        fallback_chunks = [c[0] for c in db_chunks_res.all()]

    # Retrieve relevant chunks from ChromaDB or keyword fallback
    chunks = retrieve_relevant_chunks(
        query=body.message,
        subject_id=body.subject_id,
        n_results=5,
        fallback_chunks=fallback_chunks,
    )

    # Load recent chat history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.subject_id == body.subject_id)
        .order_by(ChatMessage.id.desc())
        .limit(10)
    )
    history_msgs = [
        {"role": m.role, "content": m.content}
        for m in reversed(history_result.scalars().all())
    ]

    # Generate grounded reply
    reply = await gemini_service.rag_chat(
        user_question=body.message,
        retrieved_chunks=chunks,
        subject_name=subject_name,
        chat_history=history_msgs,
    )

    # Save user message and AI reply to history
    db.add(ChatMessage(subject_id=body.subject_id, role="user", content=body.message,
                       retrieved_chunks=json.dumps([c[:100] for c in chunks])))
    db.add(ChatMessage(subject_id=body.subject_id, role="assistant", content=reply))
    await db.commit()

    return ChatResponse(
        reply=reply,
        retrieved_chunks_count=len(chunks),
        provider="gemini" if gemini_service.client else "fallback",
    )


@app.get("/api/subjects/{subject_id}/chat-history")
async def get_chat_history(subject_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.subject_id == subject_id).order_by(ChatMessage.id)
    )
    messages = result.scalars().all()
    return [{"id": m.id, "role": m.role, "content": m.content, "created_at": str(m.created_at)} for m in messages]


# ===========================================================================
# AI SUMMARY GENERATION
# ===========================================================================

class SummaryRequest(BaseModel):
    material_id: Optional[int] = None
    chapter_title: Optional[str] = None


@app.post("/api/subjects/{subject_id}/summary")
async def generate_summary(
    subject_id: int,
    body: SummaryRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI-structured summary from a material or all subject chunks."""
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    if body.material_id:
        mat = await db.get(Material, body.material_id)
        if not mat or mat.subject_id != subject_id:
            raise HTTPException(status_code=404, detail="Material not found.")
        text = mat.extracted_text or ""
    else:
        # Combine all chunks for this subject
        chunks = retrieve_relevant_chunks(
            query=body.chapter_title or subject.name,
            subject_id=subject_id,
            n_results=10,
        )
        text = "\n\n".join(chunks)

    summary = await gemini_service.generate_summary(
        material_text=text,
        subject_name=subject.name,
        chapter_title=body.chapter_title,
    )
    return summary


# ===========================================================================
# QUIZ GENERATION & RETRIEVAL
# ===========================================================================

class QuizGenerateRequest(BaseModel):
    topic_tag: Optional[str] = None
    num_questions: int = Field(default=10, ge=3, le=20)
    save_to_db: bool = True


@app.post("/api/subjects/{subject_id}/quiz")
async def generate_quiz(
    subject_id: int,
    body: QuizGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    # Load DB chunks for subject
    db_chunks_res = await db.execute(
        select(TextChunk.content)
        .join(Material, TextChunk.material_id == Material.id)
        .where(Material.subject_id == subject_id)
    )
    fallback_chunks = [c[0] for c in db_chunks_res.all()]

    chunks = retrieve_relevant_chunks(
        query=query,
        subject_id=subject_id,
        n_results=8,
        fallback_chunks=fallback_chunks,
    )
    questions = await gemini_service.generate_quiz(
        chunks=chunks,
        subject_name=subject.name,
        topic_tag=body.topic_tag,
        num_questions=body.num_questions,
    )

    if body.save_to_db and questions:
        for q in questions:
            opts = q.get("options", ["", "", "", ""])
            db.add(QuizQuestion(
                subject_id=subject_id,
                topic_tag=q.get("topic", body.topic_tag),
                question_text=q.get("question", ""),
                option_a=opts[0] if len(opts) > 0 else "",
                option_b=opts[1] if len(opts) > 1 else "",
                option_c=opts[2] if len(opts) > 2 else "",
                option_d=opts[3] if len(opts) > 3 else "",
                correct_index=q.get("correct_index", 0),
                explanation=q.get("explanation"),
            ))
        await db.commit()

    return {"subject": subject.name, "questions": questions, "count": len(questions)}


@app.get("/api/subjects/{subject_id}/quiz")
async def get_quiz_questions(subject_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(QuizQuestion).where(QuizQuestion.subject_id == subject_id))
    questions = result.scalars().all()
    return [
        {
            "id": q.id,
            "topic": q.topic_tag,
            "question": q.question_text,
            "options": [q.option_a, q.option_b, q.option_c, q.option_d],
            "correct_index": q.correct_index,
            "explanation": q.explanation,
        }
        for q in questions
    ]


# ===========================================================================
# FLASHCARD GENERATION & RETRIEVAL
# ===========================================================================

class FlashcardGenerateRequest(BaseModel):
    deck_title: Optional[str] = None
    num_cards: int = Field(default=15, ge=5, le=40)
    save_to_db: bool = True


@app.post("/api/subjects/{subject_id}/flashcards")
async def generate_flashcards(
    subject_id: int,
    body: FlashcardGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    chunks = retrieve_relevant_chunks(
        query=body.deck_title or subject.name, subject_id=subject_id, n_results=8
    )
    cards = await gemini_service.generate_flashcards(
        chunks=chunks,
        subject_name=subject.name,
        deck_title=body.deck_title,
        num_cards=body.num_cards,
    )

    if body.save_to_db and cards:
        for card in cards:
            db.add(Flashcard(
                subject_id=subject_id,
                deck_title=body.deck_title or f"{subject.name} Deck",
                term=card.get("term", ""),
                definition=card.get("definition", ""),
                hint=card.get("hint"),
            ))
        await db.commit()

    return {"subject": subject.name, "deck_title": body.deck_title, "flashcards": cards, "count": len(cards)}


@app.get("/api/subjects/{subject_id}/flashcards")
async def get_flashcards(subject_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Flashcard).where(Flashcard.subject_id == subject_id))
    cards = result.scalars().all()
    return [
        {
            "id": c.id,
            "deck_title": c.deck_title,
            "term": c.term,
            "definition": c.definition,
            "hint": c.hint,
            "mastery_score": c.mastery_score,
            "times_reviewed": c.times_reviewed,
        }
        for c in cards
    ]


@app.patch("/api/flashcards/{flashcard_id}/mastery")
async def update_flashcard_mastery(
    flashcard_id: int,
    mastery_score: float = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Update mastery score (0.0–1.0) after a review session."""
    card = await db.get(Flashcard, flashcard_id)
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found.")
    card.mastery_score = max(0.0, min(1.0, mastery_score))
    card.times_reviewed += 1
    await db.commit()
    return {"id": card.id, "mastery_score": card.mastery_score, "times_reviewed": card.times_reviewed}


# ===========================================================================
# HEALTH & LEGACY
# ===========================================================================

@app.get("/")
async def root():
    return {
        "service": "studymate-api",
        "version": "1.0.0",
        "status": "ok",
        "endpoints": {
            "subjects": "/api/subjects",
            "upload": "/api/subjects/{id}/upload",
            "chat": "/api/chat",
            "summary": "/api/subjects/{id}/summary",
            "quiz": "/api/subjects/{id}/quiz",
            "flashcards": "/api/subjects/{id}/flashcards",
            "health": "/health",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "studymate-api", "gemini_ready": gemini_service.client is not None}


# Legacy test endpoint — kept for mobile backwards compatibility
class PipelineRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class PipelineResponse(BaseModel):
    reply: str
    provider: str


@app.post("/api/test-pipeline", response_model=PipelineResponse)
async def test_pipeline(request: PipelineRequest) -> PipelineResponse:
    reply = await gemini_service.generate_test_response(request.message)
    return PipelineResponse(reply=reply, provider="gemini" if gemini_service.client else "fallback")
