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

import datetime
import hashlib
import json
import logging
import math
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
    MasteryCache,
    QuizAttempt,
    QuizQuestion,
    Subject,
    StudyArtifact,
    TextChunk,
    find_material_by_hash,
    get_db,
    init_db,
)
from .document_processor import (
    _get_chroma_collection,
    chunk_text,
    clean_text,
    delete_material_chunks,
    delete_subject_chunks,
    extract_text,
    retrieve_relevant_chunks,
    store_chunks_in_vector_db,
)
from .gemini import AIService

logger = logging.getLogger(__name__)

settings = get_settings()
ai_service = AIService(settings)

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
    pinned: bool = False
    materials_count: int = 0
    mastery: Optional[float] = None  # overall mastery % (0-100) or None if not yet assessed

    class Config:
        from_attributes = True


# ===========================================================================
# MASTERY SCORING
# ===========================================================================
# Real mastery is derived ONLY from quiz performance (not manually editable).
# - Recency weighting: weight = exp(-days_since_attempt / 14)  (14-day half-life)
# - Passive decay: if days_since_last_attempt > 21, mastery *= max(0.5, 1 - (d-21)*0.01)
#   (floored at 50%, never reaching zero).
# - Computed per subject (overall) and per topic, then cached in `mastery_cache`.

RECENCY_HALF_LIFE_DAYS = 14.0
DECAY_START_DAYS = 21.0
DECAY_PER_DAY = 0.01
DECAY_FLOOR = 0.5
CACHE_STALE_DAYS = 1  # recompute at most once per day (for time-decay)


def _days_since(dt: Optional[datetime.datetime]) -> float:
    if dt is None:
        return 0.0
    now = datetime.datetime.utcnow()
    if dt.tzinfo is not None:
        now = now.replace(tzinfo=datetime.timezone.utc)
        dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return max(0.0, (now - dt).total_seconds() / 86400.0)


def _recency_weight(days: float) -> float:
    return math.exp(-days / RECENCY_HALF_LIFE_DAYS)


def _apply_passive_decay(value: float, last_days: float) -> float:
    if last_days <= DECAY_START_DAYS:
        return value
    factor = max(DECAY_FLOOR, 1.0 - (last_days - DECAY_START_DAYS) * DECAY_PER_DAY)
    return value * factor


def compute_mastery(
    attempts: List[QuizAttempt],
) -> Optional[dict]:
    """Pure calculation from a list of QuizAttempt rows.

    Returns None when there are no attempts (subject not yet assessed), else
    {"overall": 0-1, "by_topic": {topic: 0-1}}.
    """
    if not attempts:
        return None

    # Overall (weighted by recency).
    scores: List[float] = []
    weights: List[float] = []
    taken: List[datetime.datetime] = []
    for a in attempts:
        scores.append(float(a.score))
        weights.append(_recency_weight(_days_since(a.taken_at)))
        taken.append(a.taken_at)
    overall = sum(s * w for s, w in zip(scores, weights)) / sum(weights)
    overall = _apply_passive_decay(overall, _days_since(max(taken)))
    overall = max(0.0, min(1.0, overall))

    # Per topic.
    by_topic: dict = {}
    groups: dict = {}
    for a in attempts:
        key = a.topic or "General"
        groups.setdefault(key, []).append(a)
    for key, grp in groups.items():
        g_scores = [float(x.score) for x in grp]
        g_weights = [_recency_weight(_days_since(x.taken_at)) for x in grp]
        tm = sum(s * w for s, w in zip(g_scores, g_weights)) / sum(g_weights)
        tm = _apply_passive_decay(tm, _days_since(max(x.taken_at for x in grp)))
        by_topic[key] = max(0.0, min(1.0, tm))

    return {"overall": overall, "by_topic": by_topic}


def to_pct(value: Optional[float]) -> Optional[float]:
    """Convert a 0-1 mastery value to a 0-100 percentage (or None)."""
    if value is None:
        return None
    return round(value * 100, 1)


async def recompute_mastery(subject_id: int, db: AsyncSession) -> Optional[dict]:
    """Recompute mastery from attempts and persist it to the cache table."""
    result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.subject_id == subject_id)
    )
    attempts = result.scalars().all()
    computed = compute_mastery(attempts)  # None if no attempts
    overall = computed["overall"] if computed else None
    by_topic = computed["by_topic"] if computed else {}
    now = datetime.datetime.utcnow()

    cache = await db.get(MasteryCache, subject_id)
    if cache is None:
        cache = MasteryCache(subject_id=subject_id)
        db.add(cache)
    cache.overall = overall
    cache.by_topic = json.dumps(by_topic)
    cache.computed_at = now
    await db.commit()
    return {"overall": overall, "assessed": computed is not None, "by_topic": by_topic}


async def get_or_compute_mastery(subject_id: int, db: AsyncSession) -> Optional[dict]:
    """Return cached mastery if fresh (< 1 day), else recompute.

    Returns None only if the subject has never been assessed (no attempts).
    """
    cache = await db.get(MasteryCache, subject_id)
    if (
        cache is not None
        and cache.computed_at is not None
        and cache.overall is not None
        and _days_since(cache.computed_at) < CACHE_STALE_DAYS
    ):
        by_topic = json.loads(cache.by_topic) if cache.by_topic else {}
        return {"overall": cache.overall, "assessed": True, "by_topic": by_topic}
    return await recompute_mastery(subject_id, db)


async def get_cached_overall_pct(subject_id: int, db: AsyncSession) -> Optional[float]:
    """Read-only: cached overall mastery % (or None). Never recomputes/writes."""
    cache = await db.get(MasteryCache, subject_id)
    if cache is None or cache.overall is None:
        return None
    return to_pct(cache.overall)


@app.get("/api/subjects", response_model=List[SubjectResponse])
async def list_subjects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject))
    subjects = result.scalars().all()
    out = []
    for s in subjects:
        mats = await db.execute(select(Material).where(Material.subject_id == s.id))
        mat_count = len(mats.scalars().all())

        mastery = await get_cached_overall_pct(s.id, db)

        out.append(SubjectResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            color_tag=s.color_tag,
            pinned=s.pinned,
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
    # Slice 0.5: purge this subject's vectors so they can't be matched after deletion.
    delete_subject_chunks(subject_id)
    await db.delete(subject)
    await db.commit()


class SourceSearchRequest(BaseModel):
    question: str
    user_id: Optional[int] = None  # reserved for per-user scoping (Slice 5)


@app.post("/api/search/source")
async def search_source(
    request: SourceSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Global source-match (Slice 1): find which subject a question is about.

    Embeds the question, searches ALL chunks (no subject filter), and returns the
    owning subject_id with a confidence score. Never returns chunk content (guard G).
    """
    collection = _get_chroma_collection()
    if collection is None:
        return {"matched": False}

    try:
        results = collection.query(
            query_texts=[request.question],
            n_results=10,
            include=["metadatas", "distances"],
        )
    except Exception as e:
        logger.warning(f"Global source search failed: {e}")
        return {"matched": False}

    ids = results.get("ids", [[]])[0]
    if not ids:
        return {"matched": False}

    distances = results.get("distances", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    # Best similarity (1 - cosine distance) per subject.
    best_by_subject: dict = {}
    for dist, meta in zip(distances, metadatas):
        if not meta:
            continue
        sid = meta.get("subject_id")
        if sid is None:
            continue
        sim = 1.0 - float(dist)
        if sid not in best_by_subject or sim > best_by_subject[sid]:
            best_by_subject[sid] = sim

    if not best_by_subject:
        return {"matched": False}

    top_subject = max(best_by_subject, key=lambda s: best_by_subject[s])
    top_score = best_by_subject[top_subject]
    others = [v for s, v in best_by_subject.items() if s != top_subject]
    margin = top_score - (max(others) if others else 0.0)

    # Defensive: an orphaned chunk (deleted subject) must never match (hole A).
    subject = await db.get(Subject, top_subject)
    if subject is None:
        return {"matched": False}

    matched = top_score >= 0.20 and margin >= 0.05
    weak = matched and top_score < 0.30
    return {
        "matched": matched,
        "weak": weak,
        "subject_id": top_subject,
        "subject_name": subject.name,
        "top_score": round(top_score, 4),
        "margin": round(margin, 4),
    }


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    color_tag: Optional[str] = None
    pinned: Optional[bool] = None


@app.patch("/api/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(subject_id: int, body: SubjectUpdate, db: AsyncSession = Depends(get_db)):
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    if body.name is not None:
        existing = await db.execute(select(Subject).where(Subject.name == body.name, Subject.id != subject_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A subject with this name already exists.")
        subject.name = body.name
    if body.description is not None:
        subject.description = body.description
    if body.color_tag is not None:
        subject.color_tag = body.color_tag
    if body.pinned is not None:
        subject.pinned = body.pinned

    await db.commit()
    await db.refresh(subject)

    # Recalculate counts for response
    mats = await db.execute(select(Material).where(Material.subject_id == subject.id))
    mat_count = len(mats.scalars().all())

    mastery = await get_cached_overall_pct(subject.id, db)

    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        color_tag=subject.color_tag,
        pinned=subject.pinned,
        materials_count=mat_count,
        mastery=mastery,
    )


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
    mime_to_extension = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "application/vnd.ms-excel": "xls",
        "text/plain": "txt",
        "text/markdown": "md",
        "text/csv": "csv",
        "application/json": "json",
        "application/xml": "xml",
    }
    if ext not in SUPPORTED_EXTENSIONS:
        ext = mime_to_extension.get(file.content_type or "", ext)
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload a document, spreadsheet, presentation, text file, PDF, or image.")
    if ext in {"jpg", "jpeg", "png", "tiff", "tif", "bmp", "webp", "gif", "heic", "heif"}:
        file_type = "image"
    else:
        file_type = ext

    file_bytes = await file.read()
    file_size = len(file_bytes)
    content_hash = hashlib.sha256(file_bytes).hexdigest()
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
        content_hash=content_hash,
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


class FileReuseCheckResponse(BaseModel):
    content_hash: str
    # Does this exact file already live in a subject? (guard E/K, decision 7)
    known: bool
    existing_subject_id: Optional[int] = None
    existing_subject_name: Optional[str] = None
    # Did the existing copy finish indexing? Drives the M4/M5 handoff gate.
    already_processed: bool = False


@app.post("/api/files/reuse-check", response_model=FileReuseCheckResponse)
async def file_reuse_check(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Cheap file-identity check (Slice 4 guard E/K, decision 7).

    Hashes the uploaded file and reports whether that exact file already belongs
    to a subject. NO AI call, NO DB writes. Runs BEFORE any AI spend so a known
    file can jump straight to its subject's chat (guard K) instead of burning a
    title-suggestion call on a duplicate.
    """
    file_bytes = await file.read()
    file_size = len(file_bytes)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if file_size > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File is too large. Maximum upload size is 50 MB.")

    content_hash = hashlib.sha256(file_bytes).hexdigest()
    existing = await find_material_by_hash(db, content_hash)
    if existing is None:
        return FileReuseCheckResponse(content_hash=content_hash, known=False)

    # Defensive: the owning subject must still exist (mirrors search_source's
    # orphan guard). An orphaned material (subject deleted) counts as unknown.
    owner = await db.get(Subject, existing.subject_id)
    if owner is None:
        return FileReuseCheckResponse(content_hash=content_hash, known=False)

    return FileReuseCheckResponse(
        content_hash=content_hash,
        known=True,
        existing_subject_id=owner.id,
        existing_subject_name=owner.name,
        already_processed=existing.processing_status == "done",
    )


class ExtractTextRequest(BaseModel):
    filename: str
    file_type: str


class ExtractTextResponse(BaseModel):
    extracted_text: str
    suggested_title: str
    file_type: str


@app.post("/api/extract-text-and-suggest-title", response_model=ExtractTextResponse)
async def extract_text_and_suggest_title(
    file: UploadFile = File(...),
):
    """Extract text from an uploaded file and suggest a subject title using AI.
    Does not create any database records - just returns extracted text and suggested title."""
    fname = file.filename or "upload"
    ext = Path(fname).suffix.lower().lstrip(".")
    mime_to_extension = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "application/vnd.ms-excel": "xls",
        "text/plain": "txt",
        "text/markdown": "md",
        "text/csv": "csv",
        "application/json": "json",
        "application/xml": "xml",
    }
    if ext not in SUPPORTED_EXTENSIONS:
        ext = mime_to_extension.get(file.content_type or "", ext)
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported file type.")

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

    # Extract text
    raw_text = extract_text(file_bytes, file_type)
    clean_extracted_text = clean_text(raw_text)

    # Generate suggested title using AI
    suggested_title = await ai_service.suggest_subject_title(clean_extracted_text)

    return ExtractTextResponse(
        extracted_text=clean_extracted_text,
        suggested_title=suggested_title,
        file_type=file_type,
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
    material_ids: Optional[List[int]] = None


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
        q = (
            select(TextChunk.content)
            .join(Material, TextChunk.material_id == Material.id)
            .where(Material.subject_id == body.subject_id)
        )
        if body.material_ids:
            q = q.where(TextChunk.material_id.in_(body.material_ids))
        db_chunks_res = await db.execute(q)
        fallback_chunks = [c[0] for c in db_chunks_res.all()]
    else:
        db_chunks_res = await db.execute(select(TextChunk.content))
        fallback_chunks = [c[0] for c in db_chunks_res.all()]

    # Retrieve relevant chunks from ChromaDB or keyword fallback
    chunks = retrieve_relevant_chunks(
        query=body.message,
        subject_id=body.subject_id,
        material_ids=body.material_ids,
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
    reply = await ai_service.rag_chat(
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
        provider=ai_service.provider,
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
        # Load all chunks for this subject from DB as a fallback (parity with the
        # chat endpoint) so the summary still has material even if ChromaDB
        # returns nothing for the subject-name query.
        db_chunks_res = await db.execute(
            select(TextChunk.content)
            .join(Material, TextChunk.material_id == Material.id)
            .where(Material.subject_id == subject_id)
        )
        fallback_chunks = [c[0] for c in db_chunks_res.all()]
        chunks = retrieve_relevant_chunks(
            query=body.chapter_title or subject.name,
            subject_id=subject_id,
            n_results=10,
            fallback_chunks=fallback_chunks,
        )
        text = "\n\n".join(chunks)

    summary = await ai_service.generate_summary(
        material_text=text,
        subject_name=subject.name,
        chapter_title=body.chapter_title,
    )
    # Surface AI rate-limit / outage as a clear error instead of a silent
    # "Summary unavailable." card. The mobile client's catch handler shows a
    # friendly bubble, so the user knows it's a quota issue and not a dead feature.
    if ai_service.last_error_is_quota:
        raise HTTPException(
            status_code=503,
            detail="The AI request limit has been reached for today. "
            "The free-tier quota resets daily — try again tomorrow.",
        )
    return summary


class StudySuggestionResponse(BaseModel):
    """AI study suggestion derived from the subject's mastery insight.

    `assessed` is False when the subject has no quiz attempts yet (nothing to
    base a suggestion on). `suggestion` is the {headline, items} JSON, or null
    on transient AI failure.
    """
    assessed: bool
    overall: Optional[float] = None
    suggestion: Optional[dict] = None


@app.post("/api/subjects/{subject_id}/study-suggestion", response_model=StudySuggestionResponse)
async def study_suggestion(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
):
    """AI study suggestion anchored on the subject's focus areas (weak topics).

    Driven purely by the mastery insight — no source retrieval — so it works
    with zero uploaded notes. The mobile client caches the result against a
    mastery signature and only calls this when mastery changes (the user's
    'every mastery level change' rule), keeping AI spend to a minimum.
    """
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    mastery = await get_or_compute_mastery(subject_id, db)
    if not mastery or not mastery.get("assessed"):
        return StudySuggestionResponse(assessed=False)

    by_topic = mastery["by_topic"] or {}
    overall_pct = round((mastery["overall"] or 0) * 100)
    # Weakest topics first — these ARE the focus areas and the AI's suggestions.
    focus = sorted(by_topic.items(), key=lambda kv: kv[1])
    focus_areas = [{"topic": t, "mastery": round(m * 100)} for t, m in focus]

    suggestion = await ai_service.generate_study_suggestion(
        subject_name=subject.name,
        overall_pct=overall_pct,
        focus_areas=focus_areas,
    )
    # Same quota surfacing as the summary endpoint: a dead quota shows a friendly
    # state on the client, not a broken card.
    if ai_service.last_error_is_quota:
        raise HTTPException(
            status_code=503,
            detail="The AI request limit has been reached for today. "
            "The free-tier quota resets daily — try again tomorrow.",
        )
    return StudySuggestionResponse(
        assessed=True,
        overall=overall_pct,
        suggestion=suggestion,
    )


# ===========================================================================
# STUDY ARTIFACTS (saved summaries / quizzes / flashcards — "Save to notes")
# ===========================================================================

class ArtifactCreate(BaseModel):
    type: str  # summary | quiz | flashcards
    lead: str
    body: str
    details: Optional[dict] = None  # structured payload (key terms, questions, cards)
    source_chunks: Optional[list] = None


class ArtifactResponse(BaseModel):
    id: int
    subject_id: int
    type: str
    lead: str
    body: str
    created_at: str


@app.post("/api/subjects/{subject_id}/artifacts", response_model=ArtifactResponse)
async def save_artifact(
    subject_id: int,
    body: ArtifactCreate,
    db: AsyncSession = Depends(get_db),
):
    """Persist an AI-generated study artifact so it survives app restart.

    Called when the student taps "Save to notes" on an AIArtifactCard in the
    mobile chat. The structured `details` payload is stored as JSON.
    """
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    import json as _json
    artifact = StudyArtifact(
        subject_id=subject_id,
        type=body.type,
        lead=body.lead,
        body=body.body,
        details_json=_json.dumps(body.details) if body.details is not None else None,
        source_chunks=_json.dumps(body.source_chunks) if body.source_chunks else None,
    )
    db.add(artifact)
    await db.commit()
    await db.refresh(artifact)
    return ArtifactResponse(
        id=artifact.id,
        subject_id=artifact.subject_id,
        type=artifact.type,
        lead=artifact.lead,
        body=artifact.body,
        created_at=artifact.created_at.isoformat() if artifact.created_at else "",
    )


@app.get("/api/subjects/{subject_id}/artifacts", response_model=list[ArtifactResponse])
async def list_artifacts(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List saved study artifacts for a subject (most recent first)."""
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    res = await db.execute(
        select(StudyArtifact)
        .where(StudyArtifact.subject_id == subject_id)
        .order_by(StudyArtifact.created_at.desc())
    )
    rows = res.scalars().all()
    return [
        ArtifactResponse(
            id=a.id,
            subject_id=a.subject_id,
            type=a.type,
            lead=a.lead,
            body=a.body,
            created_at=a.created_at.isoformat() if a.created_at else "",
        )
        for a in rows
    ]


# ===========================================================================
# QUIZ GENERATION & RETRIEVAL
# ===========================================================================

class QuizGenerateRequest(BaseModel):
    topic_tag: Optional[str] = None
    num_questions: int = Field(default=10, ge=3, le=20)
    difficulty: Optional[str] = None
    material_id: Optional[int] = None
    time_limit: Optional[int] = None
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

    # Base the retrieval query on the chosen topic/material.
    query = body.topic_tag or subject.name

    # Load DB chunks for subject (optionally scoped to a single material).
    chunk_query = (
        select(TextChunk.content)
        .join(Material, TextChunk.material_id == Material.id)
        .where(Material.subject_id == subject_id)
    )
    if body.material_id is not None:
        chunk_query = chunk_query.where(TextChunk.material_id == body.material_id)
    db_chunks_res = await db.execute(chunk_query)
    fallback_chunks = [c[0] for c in db_chunks_res.all()]

    chunks = retrieve_relevant_chunks(
        query=query,
        subject_id=subject_id,
        material_id=body.material_id,
        n_results=8,
        fallback_chunks=fallback_chunks,
    )
    questions = await ai_service.generate_quiz(
        chunks=chunks,
        subject_name=subject.name,
        topic_tag=body.topic_tag,
        num_questions=body.num_questions,
        difficulty=body.difficulty,
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
# MASTERY — quiz attempt recording & computed mastery
# ===========================================================================

class QuizAttemptItem(BaseModel):
    topic: Optional[str] = None
    correct: bool


class QuizAttemptsCreate(BaseModel):
    attempts: List[QuizAttemptItem]


class MasteryResponse(BaseModel):
    overall: Optional[float] = None  # 0-100, or None if not yet assessed
    assessed: bool = False
    by_topic: dict = {}  # {topic: 0-100}


@app.post("/api/subjects/{subject_id}/quiz-attempts", response_model=MasteryResponse)
async def record_quiz_attempts(
    subject_id: int,
    body: QuizAttemptsCreate,
    db: AsyncSession = Depends(get_db),
):
    """Record per-question quiz results and recompute cached mastery.

    Each item is one answered question: its topic and whether it was correct.
    Mastery is derived purely from these attempts (never manually editable).
    """
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    taken_at = datetime.datetime.utcnow()
    for item in body.attempts:
        db.add(QuizAttempt(
            subject_id=subject_id,
            topic=item.topic,
            score=1.0 if item.correct else 0.0,
            taken_at=taken_at,
        ))
    await db.commit()

    computed = await recompute_mastery(subject_id, db)
    overall_pct = to_pct(computed["overall"]) if computed["overall"] is not None else None
    by_topic_pct = {k: to_pct(v) for k, v in computed["by_topic"].items()}
    return MasteryResponse(overall=overall_pct, assessed=computed["assessed"], by_topic=by_topic_pct)


@app.get("/api/subjects/{subject_id}/mastery", response_model=MasteryResponse)
async def get_mastery(subject_id: int, db: AsyncSession = Depends(get_db)):
    """Return overall + per-topic mastery (cached; recomputed if stale > 1 day)."""
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    result = await get_or_compute_mastery(subject_id, db)
    if result is None or not result["assessed"]:
        return MasteryResponse(overall=None, assessed=False, by_topic={})
    overall_pct = to_pct(result["overall"])
    by_topic_pct = {k: to_pct(v) for k, v in result["by_topic"].items()}
    return MasteryResponse(overall=overall_pct, assessed=True, by_topic=by_topic_pct)


# ===========================================================================
# FLASHCARD GENERATION & RETRIEVAL
# ===========================================================================

class FlashcardGenerateRequest(BaseModel):
    deck_title: Optional[str] = None
    num_cards: int = Field(default=15, ge=5, le=40)
    material_id: Optional[int] = None
    focus: Optional[str] = None
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

    query = body.deck_title or subject.name

    # Fallback chunk pool, optionally scoped to a single material.
    chunk_query = (
        select(TextChunk.content)
        .join(Material, TextChunk.material_id == Material.id)
        .where(Material.subject_id == subject_id)
    )
    if body.material_id is not None:
        chunk_query = chunk_query.where(TextChunk.material_id == body.material_id)
    db_chunks_res = await db.execute(chunk_query)
    fallback_chunks = [c[0] for c in db_chunks_res.all()]

    chunks = retrieve_relevant_chunks(
        query=query,
        subject_id=subject_id,
        material_id=body.material_id,
        n_results=8,
        fallback_chunks=fallback_chunks,
    )
    cards = await ai_service.generate_flashcards(
        chunks=chunks,
        subject_name=subject.name,
        deck_title=body.deck_title,
        num_cards=body.num_cards,
        focus=body.focus,
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
    return {"status": "ok", "service": "studymate-api", "ai_ready": ai_service.client is not None, "provider": ai_service.provider}


# Legacy test endpoint — kept for mobile backwards compatibility
class PipelineRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class PipelineResponse(BaseModel):
    reply: str
    provider: str


@app.post("/api/test-pipeline", response_model=PipelineResponse)
async def test_pipeline(request: PipelineRequest) -> PipelineResponse:
    reply = await ai_service.generate_test_response(request.message)
    return PipelineResponse(reply=reply, provider="gemini" if ai_service.client else "fallback")
