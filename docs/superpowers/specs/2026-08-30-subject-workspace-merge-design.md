# Design: Merge Chat + Subject tabs into a single "Subject Workspace"

**Date:** 2026-08-30
**Status:** Approved direction (user said "yes please the merge"). Awaiting user review of this written spec before implementation planning.
**Path:** Architectural (restructures navigation / information architecture; changes the `/api/chat` interface).

## 1. Why (problem & intent)

The app currently splits study activity across three surfaces that force extra steps:

- a standalone **Chat tab** (`ChatScreen`),
- a **Subjects tab** (`SubjectsScreen` → `SubjectDetailScreen`), and
- `SubjectDetailScreen` itself (the sources list).

This split is the root cause of the feature-loop: every NotebookLM-style behavior
(source scoping, "open chat from a file", the contextless Chat-tab gap B1) has to be
bolted onto the split, which makes the split feel worse, which suggests another
feature. The "Chat is the hub" work (CHANGES.md §7) consolidated the *logic* but not
the *visual surface* — chat still lives behind a separate tab and a separate detail
screen.

**Intent:** one workspace per subject where your sources and your chat are the *same
place* — NotebookLM's model. Tapping a subject opens its workspace: sources on top,
chat below, always grounded on the active sources. No "go to subject → tap file → open
chat" dance.

This single move **absorbs** features that were about to be built separately:
- the source-checkbox idea → becomes in-place "active sources" toggles,
- B1 (chat tab contextless) → disappears (the orphan Chat tab is removed),
- the "open chat from a file" step → deleted (chat is already there),
- Phase 2 (live mid-chat source scoping) → folded in as the active-source toggles
  (no separate context-menu entry needed).

## 2. Information architecture (target)

**BottomNav** (confirm exact current tab set in `App.tsx`/`BottomNav.tsx` during
planning — describe intent, not hard names):

- `Home` — recent subjects + quick capture (smart study box stays here).
- `Subjects` — all subjects navigator.
- `Profile` — unchanged.
- **Remove the standalone `Chat` tab.** Chat is no longer a top-level destination; it
  is reached by opening a subject into the workspace.

**Subject entry points both land in the workspace:**
- Home recent-subject tap → workspace for that subject (all sources active).
- Subjects list tap → workspace for that subject (all sources active).
- Smart-box source-match (§7) → workspace for the matched subject (all sources active).

## 3. SubjectWorkspaceScreen (replaces SubjectDetailScreen + ChatScreen)

A single screen composed of:

1. **`ScreenContextBar`** (unchanged helper) — local Back + tappable subject tile.
   Back returns to where you came from (Home recents / Subjects list), using the
   existing centralized `performBack` in `App.tsx`. The subject tile still opens the
   context menu (Switch subject / New chat) we built in §8c.
2. **Sources panel** (top, collapsible) — lists the subject's uploaded files (today's
   `SubjectDetailScreen` materials list). Each file row has an **active toggle**
   (this *is* the source-checkbox idea, in-place). Default: all sources active.
   - A file with `processing_status != 'done'` cannot be activated yet — shown
     disabled / "Processing…".
   - Toggling changes which `material_ids` ground the chat; no navigation, no new
     screen.
3. **Chat** (below) — the existing `ChatScreen` chat (messages, input bar, paperclip,
   inline SummaryCard / launcher cards from §7). It is grounded on the **active
   sources** via the backend `material_ids` filter.

No "Open chat" button, no separate chat screen. The chat is simply there.

## 4. Data flow (active sources → grounding)

```
User toggles active sources in the Sources panel
        │  selectedMaterialIds: number[]
        ▼
ChatScreen sends each message with:
   sendChatMessage(message, subjectId, materialIds)
        │
        ▼  POST /api/chat  { message, subject_id, material_ids }
        │
        ▼  retrieve_relevant_chunks(query, subject_id, material_ids)
        │       → ChromaDB where: { subject_id, material_id: { $in: material_ids } }
        ▼
rag_chat(...) answers grounded only on active sources
```

## 5. Backend changes (the one interface change)

**`backend/app/main.py` — `ChatRequest`:**
```python
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    subject_id: Optional[int] = None
    material_ids: Optional[List[int]] = None   # NEW: scope retrieval to active sources
```
`rag_chat` builds `fallback_chunks` and calls `retrieve_relevant_chunks` with
`material_ids=body.material_ids`. When `material_ids` is None → current whole-subject
behavior (backward compatible).

**`backend/app/document_processor.py` — `retrieve_relevant_chunks`:**
- Add `material_ids: Optional[List[int]] = None`.
- Build the ChromaDB `where` clause to combine `subject_id` with a
  `material_id: {"$in": material_ids}` filter when `material_ids` is provided.
  (ChromaDB already stores `material_id` metadata per chunk — confirmed in CLAUDE.md
  and `delete_material_chunks`.)
- Keyword fallback: when ChromaDB is unavailable, filter `fallback_chunks` to the
  given `material_ids` (join `TextChunk.material_id == Material.id`).

**History note:** `ChatMessage` rows stay keyed by `subject_id` (no schema change).
Retrieval grounding is what matters; subject-level history is acceptable. (If per-
selection history is later wanted, scope by a hash — see §6 — but out of scope now.)

## 6. Thread persistence (per-selection threads)

`src/storage/chatThread.ts` currently keys by `studymate_chat_thread_${subjectId}`.
Extend the key so a narrowed selection is its own durable thread:
- all sources active → `studymate_chat_thread_${subjectId}` (today's key; unchanged).
- narrowed → `studymate_chat_thread_${subjectId}_${scopeHash}` where `scopeHash` is the
  sorted, joined `material_ids`.
This keeps the full-subject thread and a scoped thread independent, and survives tab
switch / restart (the B2 fix). `clearChatThread` updated to clear all scope variants
for a deleted subject.

## 7. What is removed / deprecated

- Standalone **Chat tab** removed from BottomNav.
- `SubjectDetailScreen` is effectively merged into the workspace; its materials list
  becomes the Sources panel. Keep the screen file only if other entry points still need
  it — otherwise fold its logic into `SubjectWorkspaceScreen` and delete it.
- **`chatReturnTo` / `selectedSubject` chat-launch dance** for "open chat from a file"
  is no longer needed (chat is in the workspace). `handleSwitchChatSubject` stays (used
  by the context menu's Switch subject).

## 8. Edge cases

- **No sources active:** default = all subject sources active. Do not allow a
  zero-source chat; if the user deselects everything, treat as "all" (or disable send
  with a hint "Select at least one source").
- **File still processing:** cannot be an active source; row shows disabled state.
- **Switch subject (context menu):** opens that subject's workspace with all sources
  active by default (matches NotebookLM "open another notebook").
- **New chat (context menu):** clears the current scope's thread to `WELCOME_MESSAGE`
  (existing §8c behavior).
- **Backend unreachable:** chat falls back to local reply (existing behavior); sources
  panel still renders from cached `listMaterials`.

## 9. Testing

- **Backend:** add/extend a retrieval test asserting `material_ids` returns chunks only
  from those materials (ChromaDB `$in`), and `None` returns whole-subject chunks
  (regression). Reuse `backend/test_smart_box.py` patterns.
- **Frontend:** `npx tsc --noEmit` clean (only the two pre-existing
  `@expo/google-fonts/*` TS2307 warnings expected).
- **Live (running app):** open a subject → sources + chat visible → toggle one source
  off → ask a question whose answer only exists in another file → confirm the reply
  does not reference the toggled-off file (via `retrieved_chunks_count` / content).
  Confirm Back returns to Home/Subjects, and Switch subject / New chat still work.

## 10. Out of scope (explicitly parked)

- **A1** onboarding persist, **A2** fake-questions guard, **A3** retake-returns-to-
  origin — independent audit bugs; do not block this merge. Revisit after.
- **AI auto-title from sources** — the subject name already titles the workspace; auto
  naming from selected files is an optional later enhancement, not part of the merge.
- **Auth / Slice 5** — unchanged by this work; still blocked on the OpenRouter BYOK
  direction.

## 11. Files touched (planning detail)

Frontend:
- `mobile/App.tsx` — remove Chat tab; route subject opens → `SubjectWorkspaceScreen`;
  keep `performBack` / `handleSwitchChatSubject`.
- `mobile/src/screens/SubjectWorkspaceScreen.tsx` (NEW) — composes Sources panel +
  `ChatScreen` chat.
- `mobile/src/screens/ChatScreen.tsx` — accept `materialIds` prop; pass to
  `sendChatMessage`.
- `mobile/src/components/SourcesPanel.tsx` (NEW) — materials list + active toggles.
- `mobile/src/storage/chatThread.ts` — scoped key.
- `mobile/src/api/client.ts` — `sendChatMessage(message, subjectId, materialIds?)`.

Backend:
- `backend/app/main.py` — `ChatRequest.material_ids`; pass to retrieval.
- `backend/app/document_processor.py` — `retrieve_relevant_chunks(material_ids=...)`
  with `$in` filter + keyword-fallback filter.
