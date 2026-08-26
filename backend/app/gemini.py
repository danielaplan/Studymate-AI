"""
Gemini AI service for StudyMate — handles:
  - RAG-grounded chat (answers strictly from retrieved study material chunks)
  - AI-generated summaries of chapters/materials
  - Structured quiz generation (multiple-choice JSON output)
  - Structured flashcard generation (term/definition pairs JSON output)
"""
from __future__ import annotations

import json
import logging
from typing import List, Optional

from .config import Settings

logger = logging.getLogger(__name__)


class GeminiService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = None
        if settings.gemini_api_key:
            try:
                from google import genai  # type: ignore
                self.client = genai.Client(api_key=settings.gemini_api_key)
            except Exception as e:
                logger.warning(f"Gemini client init failed: {e}")

    # ------------------------------------------------------------------
    # Internal: raw generate
    # ------------------------------------------------------------------
    async def _generate(self, prompt: str) -> str:
        if self.client is None:
            return ""
        try:
            response = await self.client.aio.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
            )
            return (response.text or "").strip()
        except Exception as e:
            logger.error(f"Gemini generation error: {e}")
            return ""

    # ------------------------------------------------------------------
    # 1. RAG-Grounded Chat
    # ------------------------------------------------------------------
    async def rag_chat(
        self,
        user_question: str,
        retrieved_chunks: List[str],
        subject_name: Optional[str] = None,
        chat_history: Optional[List[dict]] = None,
    ) -> str:
        """
        Answer strictly from the retrieved study material chunks.
        Never uses general internet knowledge — grounded RAG only.
        """
        if not retrieved_chunks:
            if self.client:
                return await self._generate(
                    f"The student asked: '{user_question}'. "
                    "No study materials have been uploaded yet. "
                    "Politely tell them to upload their course notes first."
                )
            return (
                "No study materials are uploaded yet for this subject. "
                "Please upload your lecture notes or PDF files first so I can help you study from them."
            )

        context_block = "\n\n---\n\n".join(
            [f"[CHUNK {i+1}]\n{chunk}" for i, chunk in enumerate(retrieved_chunks)]
        )

        subject_line = f"Subject: {subject_name}\n" if subject_name else ""

        history_block = ""
        if chat_history:
            lines = []
            for msg in chat_history[-6:]:  # last 3 exchanges
                role = "Student" if msg["role"] == "user" else "StudyMate AI"
                lines.append(f"{role}: {msg['content']}")
            history_block = "Recent conversation:\n" + "\n".join(lines) + "\n\n"

        prompt = f"""You are StudyMate AI, a grounded academic study assistant.
Your ONLY source of knowledge is the student's own uploaded study material shown below.
Do NOT use any outside knowledge. If the answer is not in the materials, say so clearly.
Always cite which chunk section your answer comes from.

{subject_line}{history_block}
=== STUDENT'S STUDY MATERIALS ===
{context_block}
=== END OF MATERIALS ===

Student's Question: {user_question}

Answer concisely and clearly, grounded strictly in the above materials:"""

        reply = await self._generate(prompt)
        if not reply:
            return (
                f"I found {len(retrieved_chunks)} relevant sections in your notes but "
                "had trouble generating a response. Please check your API key or try again."
            )
        return reply

    # ------------------------------------------------------------------
    # 2. Chapter / Material Summary
    # ------------------------------------------------------------------
    async def generate_summary(
        self,
        material_text: str,
        subject_name: str,
        chapter_title: Optional[str] = None,
    ) -> dict:
        """
        Generates a structured summary from raw material text.
        Returns: {title, subtitle, overview, key_terms, takeaways}
        """
        title_hint = f'Chapter/Document: "{chapter_title}"' if chapter_title else ""
        prompt = f"""You are StudyMate AI generating a structured study summary.

Subject: {subject_name}
{title_hint}

=== MATERIAL TEXT ===
{material_text[:6000]}
=== END ===

Generate a JSON study summary with these exact fields:
{{
  "title": "<concise chapter title>",
  "subtitle": "<one-sentence overview>",
  "overview_paragraphs": ["<paragraph 1>", "<paragraph 2>"],
  "key_terms": [
    {{"term": "<term>", "explanation": "<brief definition>"}},
    ...
  ],
  "takeaways": ["<bullet point 1>", "<bullet point 2>", ...]
}}

Return ONLY valid JSON, no markdown fences."""

        raw = await self._generate(prompt)
        try:
            cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            return json.loads(cleaned)
        except Exception:
            return {
                "title": chapter_title or "Study Summary",
                "subtitle": f"Summary of {subject_name} material",
                "overview_paragraphs": [raw] if raw else ["Summary unavailable."],
                "key_terms": [],
                "takeaways": [],
            }

    # ------------------------------------------------------------------
    # 3. Quiz Generation
    # ------------------------------------------------------------------
    async def generate_quiz(
        self,
        chunks: List[str],
        subject_name: str,
        topic_tag: Optional[str] = None,
        num_questions: int = 10,
    ) -> List[dict]:
        """
        Generates structured multiple-choice quiz questions from material chunks.
        Returns list of question dicts.
        """
        combined = "\n\n".join(chunks[:8])[:5000]
        topic_line = f"Topic: {topic_tag}" if topic_tag else ""

        prompt = f"""You are StudyMate AI generating a multiple-choice quiz.

Subject: {subject_name}
{topic_line}

=== STUDY MATERIAL ===
{combined}
=== END ===

Generate exactly {num_questions} multiple-choice questions STRICTLY based on the above material.
Each question must have 4 options (A-D) with exactly one correct answer.

Return ONLY a JSON array:
[
  {{
    "topic": "<topic label in CAPS>",
    "question": "<question text>",
    "options": ["<A>", "<B>", "<C>", "<D>"],
    "correct_index": <0-3>,
    "explanation": "<why this is correct, citing the material>"
  }},
  ...
]

No markdown fences. Return ONLY valid JSON."""

        raw = await self._generate(prompt)
        try:
            cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            questions = json.loads(cleaned)
            if not isinstance(questions, list):
                raise ValueError("Expected a list")
            return questions
        except Exception as e:
            logger.warning(f"Quiz JSON parse failed: {e}")
            return []

    # ------------------------------------------------------------------
    # 4. Flashcard Generation
    # ------------------------------------------------------------------
    async def generate_flashcards(
        self,
        chunks: List[str],
        subject_name: str,
        deck_title: Optional[str] = None,
        num_cards: int = 15,
    ) -> List[dict]:
        """
        Generates term/definition flashcard pairs from material chunks.
        Returns list of flashcard dicts.
        """
        combined = "\n\n".join(chunks[:8])[:5000]
        deck_line = f'Deck: "{deck_title}"' if deck_title else ""

        prompt = f"""You are StudyMate AI generating study flashcards.

Subject: {subject_name}
{deck_line}

=== STUDY MATERIAL ===
{combined}
=== END ===

Generate exactly {num_cards} flashcards STRICTLY from the material above.
Each card should test a key concept, definition, or relationship.

Return ONLY a JSON array:
[
  {{
    "term": "<key concept or question>",
    "definition": "<clear, concise answer or explanation>",
    "hint": "<optional memory hint or mnemonic>"
  }},
  ...
]

No markdown fences. Return ONLY valid JSON."""

        raw = await self._generate(prompt)
        try:
            cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            cards = json.loads(cleaned)
            if not isinstance(cards, list):
                raise ValueError("Expected a list")
            return cards
        except Exception as e:
            logger.warning(f"Flashcard JSON parse failed: {e}")
            return []

    # ------------------------------------------------------------------
    # Legacy test endpoint (kept for backwards compat)
    # ------------------------------------------------------------------
    async def generate_test_response(self, message: str) -> str:
        reply = await self._generate(
            f"You are StudyMate AI. Answer this concisely: {message}"
        )
        return reply or f"Backend received: {message}. Add GEMINI_API_KEY to enable AI responses."
