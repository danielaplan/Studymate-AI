"""
Document processing pipeline for StudyMate AI.
Handles: PDF text extraction, image OCR, text chunking, and ChromaDB vector storage.
"""
from __future__ import annotations

import io
import logging
import re
import uuid
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Text Extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract raw text from a PDF file using PyPDF2."""
    try:
        import PyPDF2  # type: ignore
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        pages_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text.strip())
        return "\n\n".join(pages_text)
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        return ""


def extract_text_from_image(file_bytes: bytes) -> str:
    """Extract text from an image using Tesseract OCR."""
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
        img = Image.open(io.BytesIO(file_bytes))
        return pytesseract.image_to_string(img).strip()
    except Exception as e:
        logger.warning(f"OCR extraction failed (Tesseract may not be installed): {e}")
        return ""


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """Dispatch to the correct extractor based on file type."""
    ft = file_type.lower()
    if ft == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ft in {"image", "scan", "jpg", "jpeg", "png", "tiff", "bmp", "webp"}:
        return extract_text_from_image(file_bytes)
    else:
        # Attempt PDF first, then OCR as fallback
        text = extract_text_from_pdf(file_bytes)
        if not text:
            text = extract_text_from_image(file_bytes)
        return text


# ---------------------------------------------------------------------------
# Text Chunking
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """Normalise whitespace and remove junk characters."""
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\x20-\x7E\n]", "", text)
    return text.strip()


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 80) -> List[str]:
    """
    Split text into overlapping chunks based on word count.
    Each chunk is ~chunk_size words with `overlap` words carried over.
    """
    words = text.split()
    if not words:
        return []

    chunks: List[str] = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end == len(words):
            break
        start += chunk_size - overlap

    return [c for c in chunks if len(c.strip()) > 30]


# ---------------------------------------------------------------------------
# ChromaDB Vector Storage
# ---------------------------------------------------------------------------

CHROMA_PATH = Path(__file__).parent.parent.parent / "database" / "chroma_store"
CHROMA_PATH.mkdir(parents=True, exist_ok=True)


def _get_chroma_collection(collection_name: str = "studymate_chunks"):
    """Get or create a ChromaDB persistent collection."""
    try:
        import chromadb  # type: ignore
        client = chromadb.PersistentClient(path=str(CHROMA_PATH))
        collection = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        return collection
    except Exception as e:
        logger.error(f"ChromaDB init failed: {e}")
        return None


def store_chunks_in_vector_db(
    chunks: List[str],
    material_id: int,
    subject_id: int,
) -> List[str]:
    """
    Embed and store text chunks in ChromaDB.
    Returns list of chroma_ids for each chunk.
    """
    collection = _get_chroma_collection()
    if collection is None:
        return [f"fallback-{i}" for i in range(len(chunks))]

    chroma_ids: List[str] = []
    for i, chunk in enumerate(chunks):
        cid = f"mat{material_id}_chunk{i}_{uuid.uuid4().hex[:8]}"
        try:
            collection.add(
                documents=[chunk],
                ids=[cid],
                metadatas=[{"material_id": material_id, "subject_id": subject_id, "chunk_index": i}],
            )
            chroma_ids.append(cid)
        except Exception as e:
            logger.warning(f"Failed to store chunk {i}: {e}")
            chroma_ids.append(f"error-{i}")

    return chroma_ids


def retrieve_relevant_chunks(
    query: str,
    subject_id: Optional[int] = None,
    n_results: int = 5,
) -> List[str]:
    """
    Query ChromaDB to retrieve the most semantically relevant chunks.
    Optionally filter by subject_id.
    Returns list of raw chunk text strings.
    """
    collection = _get_chroma_collection()
    if collection is None:
        return []

    try:
        where = {"subject_id": subject_id} if subject_id else None
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where,
        )
        docs = results.get("documents", [[]])[0]
        return [d for d in docs if d]
    except Exception as e:
        logger.warning(f"ChromaDB query failed: {e}")
        return []


def delete_material_chunks(material_id: int) -> None:
    """Remove all vectors for a given material from ChromaDB."""
    collection = _get_chroma_collection()
    if collection is None:
        return
    try:
        collection.delete(where={"material_id": material_id})
    except Exception as e:
        logger.warning(f"Failed to delete chunks for material {material_id}: {e}")
