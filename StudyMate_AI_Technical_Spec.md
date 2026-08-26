# StudyMate AI — Project Technical Specification & Blueprint
### Final Architecture (Gemini API + React Native Edition)

---

## 1. Project Vision & Core Goal

StudyMate AI is a student-focused AI study companion built on the concept of **"Study with your own materials."** Instead of relying on general internet knowledge, the platform processes user-uploaded PDFs, lecture notes, scanned documents, and handwritten notes to act as a personalized AI tutor grounded strictly in the student's curriculum.

**Positioning statement:**
> *A grounded, citation-backed RAG study companion — the AI answers only from YOUR notes, not generic internet knowledge.*

This is the project's core differentiator: not "runs offline," but **"never hallucinates outside your materials."**

---

## 2. Technology Stack Architecture

| Layer | Technology | Primary Function |
|---|---|---|
| **Mobile Client** | React Native (Expo) | Cross-platform UI for Android and iOS devices |
| **Backend API** | Python + FastAPI | Handles file uploads, document extraction, vector indexing, and AI orchestration |
| **AI Intelligence Engine** | Google Gemini API | Executes context-grounded Q&A, summaries, quizzes, and flashcards |
| **Vector Storage** | FAISS / ChromaDB | Stores document embeddings locally for Retrieval-Augmented Generation (RAG) |
| **Relational Database** | SQLite / PostgreSQL | Manages subject categories, user progress, flashcards, and chat history |
| **OCR & Parsing** | PyPDF / Tesseract OCR | Extracts clean text from native PDFs, images, and scanned documents |

### Why Gemini API over Local Ollama

| Factor | Local Ollama (7B–8B) | Gemini API |
|---|---|---|
| Setup complexity | High — prompt engineering to get reliable JSON | Low — strong structured output out of the box |
| Quiz/flashcard quality | Inconsistent, weak distractors | Reliable, well-calibrated |
| Dev timeline | Slower — fighting model limitations | Faster — focus on app features |
| Cost | Free (local compute) | Free tier is generous for a student project |
| Offline capability | Yes | No — requires internet |
| Portfolio narrative | "Offline AI" (harder to execute well) | "RAG architecture, grounded, citation-backed" (equally impressive, easier to ship well) |

**Decision:** Local embeddings (fast, free, private) + cloud Gemini for generation (quality, reliability, faster dev). This keeps document content mostly local — only the retrieved chunks + question are sent to the API, not entire documents.

---

## 3. Core Functional Requirements (MVP Scope)

- **Subject & Material Management** — Organize uploaded documents into distinct subject folders (e.g., Programming, Networking, Mathematics)
- **Document Processing Pipeline** — Automatically parse PDFs and images using OCR, clean extracted text, chunk context, and generate vector embeddings
- **Context-Grounded AI Chat** — RAG-driven chat interface that retrieves relevant note sections to answer user questions with source citations
- **AI Summary Generator** — Summarizes selected document chapters into main concepts, key terms, and bulleted takeaways
- **Structured Quiz Generator** — Automatically converts document chunks into multiple-choice, true/false, or identification quizzes
- **Interactive Flashcards** — Generates flip-card question and answer pairs from uploaded study reviewers

---

## 4. End-to-End System Workflow

```
[Student Uploads PDF/Image]
          │
          ▼
[FastAPI: Text Extraction & OCR]
          │
          ▼
[Text Chunking & Embedding Generation] (local)
          │
          ▼
[FAISS / ChromaDB Vector Storage] (local)
          │
          ▼
[Student Asks Question in React Native App]
          │
          ▼
[FastAPI Vector Search → Retrieves Relevant Chunks] (local)
          │
          ▼
[Gemini API Prompting → Structured Output] (cloud)
          │
          ▼
[Render Response / Quiz / Flashcards in React Native UI]
```

---

## 5. Development Phases & Roadmap

### Phase 1: Project Foundation
- Set up workspace repositories (`/mobile`, `/backend`, `/database`)
- Establish communication pipeline: React Native → FastAPI → Gemini API
- Set up SQLite database schema
- Secure Gemini API key handling (environment variables, never hardcoded)

### Phase 2: Document Processing & RAG
- Build upload endpoints (`POST /upload`) for PDFs and scanned images
- Implement OCR and text extraction scripts
- Integrate vector database (FAISS/ChromaDB) for chunk storage and retrieval

### Phase 3: AI Learning Features
- Build context-bounded RAG chat route
- Implement chapter summarization logic
- Build structured JSON generation pipelines for quizzes and flashcard decks

### Phase 4: UI & Polish
- Implement Subject & Folder system in React Native
- Add dark mode, loading indicators, empty states, and storage management
- Conduct end-to-end testing across target mobile hardware benchmarks
- Handle offline/no-connection states gracefully (since AI features now require internet)

---

## 6. Portfolio Notes

- Emphasize the RAG architecture and grounding/citation mechanism in demo materials — this is the technically impressive part, independent of local vs. cloud AI
- Document the reasoning for choosing Gemini API over local models in project write-up (shows engineering judgment, not just "picked the easy option")
- Screenshot/demo the citation feature specifically — showing the AI point back to source notes is a strong visual proof of grounding
