"""
AI service for StudyMate — provider-agnostic wrapper that handles:
  - RAG-grounded chat (answers strictly from retrieved study material chunks)
  - AI-generated summaries of chapters/materials
  - Structured quiz generation (multiple-choice JSON output)
  - Structured flashcard generation (term/definition pairs JSON output)

Provider is selected by AI_PROVIDER (default: "openrouter"). OpenRouter is used
via its OpenAI-compatible chat/completions endpoint (httpx). Gemini remains
available as a fallback provider. All calls funnel through _generate().
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import date
from typing import List, Optional

import httpx
from .config import Settings

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.provider = (settings.ai_provider or "openrouter").lower()
        self.client = None  # truthy when a provider is configured (kept for health checks)
        self.last_error: Optional[str] = None
        self.last_error_is_quota: bool = False

        # OpenRouter transport config
        self.openrouter_key: Optional[str] = settings.openrouter_api_key
        self.openrouter_model: str = settings.openrouter_model or ""
        self.openrouter_base: str = settings.openrouter_base_url
        self.daily_limit: int = settings.openrouter_daily_limit
        self.site_url: str = settings.openrouter_site_url
        self.app_name: str = settings.openrouter_app_name

        # In-memory daily request counter (single-process dev guardrail so we
        # don't slam OpenRouter's per-model free-tier limits).
        self._usage_date = date.today()
        self._usage_count = 0

        if self.provider == "openrouter":
            if self.openrouter_key:
                self.client = httpx.AsyncClient(timeout=60.0)
            else:
                logger.warning("Provider is 'openrouter' but OPENROUTER_API_KEY is missing.")
        else:
            # Legacy Gemini path
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
        # --- Daily rate-limit guard (OpenRouter free models have a per-model cap) ---
        today = date.today()
        if self._usage_date != today:
            self._usage_date = today
            self._usage_count = 0
        if self._usage_count >= self.daily_limit:
            self.last_error = "Daily request limit reached."
            self.last_error_is_quota = True
            logger.warning("OpenRouter daily request limit reached for today.")
            return ""

        if self.provider == "openrouter":
            if not self.openrouter_key:
                return ""
            self._usage_count += 1
            last_exc: Optional[Exception] = None
            for attempt in range(2):
                try:
                    resp = await self.client.post(
                        f"{self.openrouter_base}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.openrouter_key}",
                            "HTTP-Referer": self.site_url,
                            "X-Title": self.app_name,
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": self.openrouter_model,
                            "messages": [{"role": "user", "content": prompt}],
                            "temperature": 0.4,
                        },
                    )
                    if resp.status_code == 429:
                        self.last_error = resp.text
                        self.last_error_is_quota = True
                        logger.warning("OpenRouter 429 (rate limited, attempt %d/2)", attempt + 1)
                        if attempt == 0:
                            await asyncio.sleep(4)  # transient upstream throttle — back off once
                            continue
                        return ""
                    resp.raise_for_status()
                    data = resp.json()
                    text = (data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
                    self.last_error = None
                    self.last_error_is_quota = False
                    return text
                except Exception as e:  # noqa: BLE001
                    last_exc = e
                    err = str(e).lower()
                    # Retry once on transient/rate-limit style errors before giving up.
                    if attempt == 0 and any(k in err for k in ("429", "rate limit", "rate_limit", "timeout")):
                        await asyncio.sleep(4)
                        continue
                    self.last_error = str(e)
                    self.last_error_is_quota = any(
                        k in err for k in ("429", "resource_exhausted", "quota", "rate limit", "rate_limit")
                    )
                    logger.error(f"OpenRouter generation error: {self.last_error}")
                    return ""
            self.last_error = str(last_exc)
            return ""
        else:
            # --- Legacy Gemini path ---
            if self.client is None:
                return ""
            try:
                response = await self.client.aio.models.generate_content(
                    model=self.settings.gemini_model,
                    contents=prompt,
                )
                self.last_error = None
                self.last_error_is_quota = False
                return (response.text or "").strip()
            except Exception as e:
                self.last_error = str(e)
                err = self.last_error.lower()
                self.last_error_is_quota = any(
                    k in err for k in ("429", "resource_exhausted", "quota", "rate limit", "rate_limit")
                )
                logger.error(f"Gemini generation error: {self.last_error}")
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
            if self.last_error_is_quota:
                return (
                    f"I found {len(retrieved_chunks)} relevant sections in your notes, but the AI "
                    "request limit has been reached for today. Your plan's free-tier quota resets "
                    "daily — come back tomorrow to keep chatting. In the meantime, your saved "
                    "summaries and notes are still available in each subject."
                )
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
        Returns: {title, subtitle, overview_paragraphs, key_terms, takeaways}
        The subtitle is the concise MAIN IDEA — specific and content-rich so the
        student instantly grasps what the material is about.
        """
        title_hint = f'Chapter/Document: "{chapter_title}"' if chapter_title else ""
        prompt = f"""You are StudyMate AI generating a structured study summary from a student's uploaded notes.

Subject: {subject_name}
{title_hint}

=== MATERIAL TEXT ===
{material_text[:8000]}
=== END ===

Write a JSON study summary with these exact fields:
{{
  "title": "<concise chapter/section title>",
  "subtitle": "<ONE informative sentence stating the MAIN IDEA of the material — what it is fundamentally about and the single most important takeaway. Be specific and concrete, naming the actual topics/concepts. NEVER write generic phrases like 'Summary of ...' or 'An overview of ...'. GOOD example: 'This material explains how ETL pipelines extract, transform, and load data while applying validation rules that catch quality issues before they reach the warehouse.' BAD example: 'Summary of ETL Processes material'.",
  "overview_paragraphs": ["<paragraph 1 explaining the core concepts in plain language>", "<paragraph 2 with the next key idea>"],
  "key_terms": [
    {{"term": "<term>", "explanation": "<brief, clear definition>"}},
    ...
  ],
  "takeaways": ["<bullet point 1>", "<bullet point 2>", ...]
}}

Return ONLY valid JSON, no markdown fences."""

        raw = await self._generate(prompt)
        try:
            cleaned = raw.strip()
            # Strip markdown code fences if present
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            # Extract the JSON object in case extra prose wrapped it
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                cleaned = cleaned[start : end + 1]

            result = json.loads(cleaned)

            # Guarantee an informative subtitle: if it's missing or generic,
            # fall back to the first overview paragraph instead of a placeholder.
            subtitle = (result.get("subtitle") or "").strip()
            generic_markers = ("summary of", "overview of", "an overview", "this document provides")
            if not subtitle or any(marker in subtitle.lower() for marker in generic_markers):
                paras = result.get("overview_paragraphs") or []
                subtitle = paras[0].strip() if paras else f"Core concepts from {subject_name}."
            result["subtitle"] = subtitle
            return result
        except Exception as e:
            logger.warning(f"Summary JSON parse failed: {e}")
            return {
                "title": chapter_title or subject_name or "Study Summary",
                "subtitle": f"Core concepts and key ideas covered in {subject_name}.",
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
        difficulty: Optional[str] = None,
    ) -> List[dict]:
        """
        Generates structured multiple-choice quiz questions from material chunks.
        Returns list of question dicts.
        """
        combined = "\n\n".join(chunks[:8])[:5000]
        topic_line = f"Topic: {topic_tag}" if topic_tag else ""
        difficulty_line = (
            f"Target difficulty: {difficulty}. Make questions appropriately challenging for that level."
            if difficulty
            else ""
        )

        prompt = f"""You are StudyMate AI generating a multiple-choice quiz.

Subject: {subject_name}
{topic_line}
{difficulty_line}

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
        focus: Optional[str] = None,
    ) -> List[dict]:
        """
        Generates term/definition flashcard pairs from material chunks.
        Returns list of flashcard dicts.
        """
        combined = "\n\n".join(chunks[:8])[:5000]
        deck_line = f'Deck: "{deck_title}"' if deck_title else ""
        focus_line = ""
        if focus:
            focus_desc = {
                "definitions": "Make each card a precise term/definition pair.",
                "concepts": "Make each card explain a key idea or concept in plain language.",
                "qa": "Make each card a question on one side and a clear answer on the other.",
            }.get(focus, focus)
            focus_line = f"Focus: {focus_desc}"

        prompt = f"""You are StudyMate AI generating study flashcards.

Subject: {subject_name}
{deck_line}
{focus_line}

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
    # 5. Subject Title Suggestion
    # ------------------------------------------------------------------
    async def suggest_subject_title(self, material_text: str) -> str:
        """
        Suggests a concise subject title based on the uploaded material content.
        Returns a short title string (max ~50 chars).
        """
        prompt = f"""Analyze the following study material and suggest a concise, descriptive subject title.
The title should be 2-5 words, academic in tone, and capture the main topic.

=== MATERIAL TEXT ===
{material_text[:3000]}
=== END ===

Return ONLY the suggested title, nothing else. No quotes, no markdown."""

        raw = await self._generate(prompt)
        if not raw:
            return "Study Notes"
        # Clean up the response - take first line, remove quotes, limit length
        title = raw.strip().split('\n')[0].strip('"\'').strip()
        return title[:60] if title else "Study Notes"

    # ------------------------------------------------------------------
    # Legacy test endpoint (kept for backwards compat)
    # ------------------------------------------------------------------
    async def generate_test_response(self, message: str) -> str:
        reply = await self._generate(
            f"You are StudyMate AI. Answer this concisely: {message}"
        )
        return reply or f"Backend received: {message}. Add GEMINI_API_KEY to enable AI responses."
