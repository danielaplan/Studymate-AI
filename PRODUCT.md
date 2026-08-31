# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One Expo / React Native codebase shipping iOS and Android as co-primary native targets, with web as a secondary convenience target. The design language is intentionally **shared** (a single universal theme in `mobile/src/theme/`), not per-OS adapted — recorded as `adaptive` so later work loads both native references without diverging the visual system per platform.

## Users

General student audience (no single dominant segment). Spans university students, high-school / exam-prep learners, and lifelong / self-taught adults studying from scattered personal materials. Users are comfortable with consumer apps and increasingly with AI tools, but vary widely in study discipline, domain, and confidence. Design for breadth: flows must work for a first-time, low-context learner and stay efficient for a power user.

## Product Purpose

StudyMate AI is a grounded AI study companion that turns a user's own notes, documents, and scanned materials into an interactive tutor. Users upload study files, ask citation-backed questions, generate summaries and quizzes, and review concepts with AI-powered flashcards. Success means the user **genuinely understands the material** — they grasp concepts through grounded Q&A and structured summaries, not merely memorize answers.

## Positioning

The defensible, copyable-by-no-neighbor claim: **grounded RAG with citations**. Per the backend contract, `GeminiService.rag_chat()` explicitly forbids outside knowledge; every answer must cite the retrieved source chunks from the user's own uploaded materials. Competitors that let the model improvise from parametric memory sacrifice the trust a student needs before an exam. StudyMate's value is "your sources, answered faithfully" — OCR → chunk → embed → retrieve → grounded generation, with the user's documents as the single source of truth.

## Operating Context

- **Input materials:** user PDFs, images/scans (Tesseract OCR), and notes. Async pipeline: `pending → processing → done/failed`.
- **Core workflows:** create subject → upload material → (OCR/chunk/embed) → chat (citation-backed), summary, quiz, flashcards; review flashcards to build per-card mastery; track subject mastery as average flashcard score.
- **Surfaces (mobile):** Home, Subjects, SubjectDetail, SubjectWorkspace, Chat, Summary, Flashcards, Quiz (setup/overview/play), Profile, Onboarding — custom screen routing in `App.tsx` (no Expo Router).
- **Environments:** local-first dev (SQLite + ChromaDB); backend FastAPI at `localhost:8000` with platform-resolved API URL; `GEMINI_API_KEY` enables AI, otherwise local fallback.
- **Rituals:** exam prep / cramming, concept review, spaced flashcard practice.

## Capabilities and Constraints

- **Stack (confirmed by codebase):** React Native / Expo + TypeScript client; FastAPI + Python (async SQLAlchemy) backend with Gemini; SQLite (dev) + ChromaDB vector store; OCR via PyPDF2 + Tesseract.
- **Grounded answers only:** chat must cite chunks; no outside knowledge. Structured AI outputs (summary/quiz/flashcards) are strict JSON, validated with fallback.
- **Mastery model:** flashcards carry `mastery_score` (0–1) + `times_reviewed`; subject mastery = average flashcard score.
- **Native affordances:** must respect iOS and Android navigation/back expectations; portrait orientation; `supportsTablet: true` on iOS. `predictiveBackGestureEnabled: false` on Android.
- **Undecided:** monetization/pricing, multi-user/accounts scope, and a definitive primary user segment are not established — design must not assume any.

## Brand Commitments

- **Name:** StudyMate AI. **Voice:** calm, trustworthy, studious — never hypey; the product's job is to earn academic trust, so copy should sound like a reliable tutor, not a game.
- **Existing assets (committed, not a direction to expand):** brand-green palette anchored in `theme/colors.ts` (`brandGreen #243C2C` family, sage badges, distinct artifact-card forest-tint palette); typography pairs Playfair Display (display) with Inter (text) via Expo Google Fonts. These are incumbent visual facts to preserve, recorded here so new-work treats them as evidence, not a blank slate.

## Evidence on Hand

- `README.md` — product description and GitHub topic metadata.
- `CLAUDE.md` — architecture, data flow (upload → RAG), endpoint + schema reference.
- `StudyMate_AI_Technical_Spec.md` — technical spec.
- `CHANGES.md` — ongoing change/handoff log (large; consult for recent direction).
- `mobile/src/theme/{colors,typography,index}.ts` — incumbent design tokens.
- `mobile/app.json` — Expo config (platforms, orientation, icons).
- Absent and must not be fabricated: real testimonials, benchmarks, case studies, pricing, or named institutional customers.

## Product Principles

1. **Ground truth in the user's materials.** Every AI output traces back to uploaded sources; trust is the product.
2. **Understanding over memorization.** Optimize for comprehension (grounded Q&A, summaries, explanations), not just recall streaks.
3. **Breadth over niche.** One calm, capable system that serves any learner from any material.
4. **Respect the platform.** Native iOS/Android expectations and the shared theme come first; web follows.

## Accessibility & Inclusion

Mobile-native accessibility expectations apply (touch targets, contrast, dynamic type). Audience includes learners with varying confidence and study discipline; copy and flows must stay legible and low-intimidation for first-time users. No specific disability requirement was established beyond standard native a11y.
