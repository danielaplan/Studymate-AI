"""
SQLite database schema & session management for StudyMate AI.
Tables: subjects, materials, chunks, flashcards, quiz_questions, chat_history
"""
from __future__ import annotations

import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    select,
    text,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship

DB_PATH = Path(__file__).parent.parent.parent / "database" / "studymate.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"


class Base(DeclarativeBase):
    pass


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    color_tag = Column(String(32), nullable=True, default="#334F2B")
    pinned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    materials = relationship("Material", back_populates="subject", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="subject", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="subject", cascade="all, delete-orphan")
    chat_history = relationship("ChatMessage", back_populates="subject", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="subject", cascade="all, delete-orphan")
    mastery_cache = relationship("MasteryCache", back_populates="subject", uselist=False, cascade="all, delete-orphan")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    filename = Column(String(512), nullable=False)
    file_path = Column(String(1024), nullable=False)
    file_type = Column(String(64), nullable=False)  # pdf | image | scan
    file_size_bytes = Column(Integer, nullable=True)
    extracted_text = Column(Text, nullable=True)
    content_hash = Column(String(64), nullable=True)  # sha256 hex of file bytes; dedup/reuse key
    processing_status = Column(String(32), default="pending")  # pending | processing | done | failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="materials")
    chunks = relationship("TextChunk", back_populates="material", cascade="all, delete-orphan")


class TextChunk(Base):
    __tablename__ = "text_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    chroma_id = Column(String(256), nullable=True)  # reference ID in ChromaDB
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    material = relationship("Material", back_populates="chunks")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    deck_title = Column(String(512), nullable=False)
    term = Column(Text, nullable=False)
    definition = Column(Text, nullable=False)
    hint = Column(Text, nullable=True)
    source_chunk_id = Column(Integer, ForeignKey("text_chunks.id"), nullable=True)
    mastery_score = Column(Float, default=0.0)  # 0.0 - 1.0
    times_reviewed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="flashcards")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    topic_tag = Column(String(255), nullable=True)
    question_text = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_index = Column(Integer, nullable=False)  # 0-3 (A, B, C, D)
    explanation = Column(Text, nullable=True)
    source_chunk_id = Column(Integer, ForeignKey("text_chunks.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="quiz_questions")


class ChatMessage(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    role = Column(String(16), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    retrieved_chunks = Column(Text, nullable=True)  # JSON list of chunk IDs used
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="chat_history")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)  # single-user app; no users table, FK unused
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    topic = Column(String(255), nullable=True)  # topic / chunk / source reference
    score = Column(Float, nullable=False)  # 0.0 - 1.0 (1.0 = correct)
    taken_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="quiz_attempts")


class MasteryCache(Base):
    """Cached, computed mastery per subject to avoid recomputing on every read.

    `overall` is 0.0-1.0 or NULL when the subject has not been assessed yet.
    `by_topic` is a JSON object mapping topic -> 0.0-1.0 mastery.
    """

    __tablename__ = "mastery_cache"

    subject_id = Column(Integer, ForeignKey("subjects.id"), primary_key=True)
    overall = Column(Float, nullable=True)
    by_topic = Column(Text, nullable=True)
    computed_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="mastery_cache")


# ---------------------------------------------------------------------------
# Async engine & session factory
# ---------------------------------------------------------------------------
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    """Create all tables on startup; add columns create_all cannot alter in."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migration: create_all won't add columns to existing tables. Add
        # content_hash to materials if it isn't present yet (one-time, safe).
        cols = {
            row[1]
            for row in (await conn.execute(text("PRAGMA table_info(materials)"))).fetchall()
        }
        if "content_hash" not in cols:
            await conn.execute(text("ALTER TABLE materials ADD COLUMN content_hash VARCHAR(64)"))


async def get_db() -> AsyncSession:  # type: ignore[return]
    """Dependency-injectable async DB session."""
    async with AsyncSessionLocal() as session:
        yield session


async def find_material_by_hash(db: AsyncSession, content_hash: str) -> Optional[Material]:
    """Find an existing material by its file-content hash (dedup / source reuse)."""
    result = await db.execute(select(Material).where(Material.content_hash == content_hash))
    return result.scalars().first()
