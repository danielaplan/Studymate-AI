// Lightweight intent detection for the Home prompt box.
//
// Replaces the old brittle substring checks ("includes('quiz')") with
// word-boundary regexes so phrasing like "make a quiz", "test me", or
// "flashcards for chapter 3" route correctly. The 'chat' intent is the
// default (ask / explain / anything else) and is grounded in RAG.
//
// 2026-08-28 (user request: "expand the wording, the synonyms of the request"):
// each intent now covers a wide synonym set, and a new 'review' intent catches
// ambiguous study-help phrasings ("review me on this file", "help me study",
// "go over this") that don't name a format. The chat hub answers 'review' with
// a choice bubble (quiz / flashcards / summary) instead of guessing.
// Deliberately zero-AI: instant, offline, no free-tier quota burned per
// message (guard-M2 principle).

export type Intent = 'quiz' | 'summary' | 'flashcards' | 'review' | 'chat';

const QUIZ_RE =
  /\b(quiz|quizzes|test me|test my knowledge|mcq|multiple choice|questions?|exam|mock exam|practice test|practice|challenge me|check my understanding|see what i know)\b/i;
const SUMMARY_RE =
  /\b(summari[sz]e[ds]?|summari[sz]ing|summary|summaries|sum up|overview|recap|tl;?dr|key points|main ideas|key takeaways|brief me|the gist|gist)\b/i;
const FLASHCARD_RE =
  /\b(flash ?cards?|memory cards|study cards|memori[sz]e[ds]?|memori[sz]ing|drill me|recall)\b/i;
// Ambiguous "study help" phrasings — the user wants to study/review but didn't
// name a format. Checked AFTER the specific intents, so "review me with
// flashcards" still routes to flashcards (specific wins).
const REVIEW_RE =
  /\b(review|revise|revision|help me study|study session|let'?s study|study with me|go over|run through|walk me through|brush up|refresh my memory|prep me|prepare me|cram)\b/i;

export function detectIntent(text: string): Intent {
  const t = text.trim().toLowerCase();
  if (!t) return 'chat';
  if (QUIZ_RE.test(t)) return 'quiz';
  if (SUMMARY_RE.test(t)) return 'summary';
  if (FLASHCARD_RE.test(t)) return 'flashcards';
  if (REVIEW_RE.test(t)) return 'review';
  return 'chat';
}

export type RoutedTarget = 'quiz' | 'summary' | 'flashcards' | 'chat';

// Single owner of "where does this prompt go" (Slice 3). The plain box uses
// guided=false → existing intent router → dedicated screens. The smart-box guided
// flow uses guided=true → always Chat (pre-filled handoff), never a dedicated screen.
export function resolveRouting(prompt: string, guided: boolean): RoutedTarget {
  if (guided) return 'chat';
  const intent = detectIntent(prompt);
  // 'review' is ambiguous → the chat hub owns it (offers the quiz / flashcards
  // / summary choice bubble), never a direct dedicated screen.
  return intent === 'review' ? 'chat' : intent;
}

// Live suggestion chips shown as the user types. When an intent keyword is
// detected we offer it scoped to the user's subjects; otherwise we offer a
// scoped explanation plus a plain one. Guards against noisy/irrelevant chips:
//  - nothing until the input has at least one real word (3+ chars),
//  - subjects are ranked by word-overlap with the input (NOT list order),
//  - generic questions are only paired with subjects whose names match; if
//    none match, only the un-scoped "Explain X" chip is offered (no fake
//    "using my <unrelated subject> notes" pairing).
export function buildSuggestions(
  input: string,
  subjects: { id: string; name: string }[]
): string[] {
  const t = input.trim().toLowerCase();
  if (t.length < 3) return [];

  // Rank subjects by how many input words appear in their name.
  const words = t.split(/\s+/).filter((w) => w.length > 2);
  const scored = subjects
    .map((s) => {
      const name = s.name.toLowerCase();
      const score = words.reduce((acc, w) => (name.includes(w) ? acc + 1 : acc), 0);
      return { s, score };
    })
    .sort((a, b) => b.score - a.score);
  const relevant = scored.filter((r) => r.score > 0).map((r) => r.s);
  // Intent chips (quiz/summary/flashcards): prefer relevant subjects, fall back
  // to list order since the intent itself is already explicit.
  const pool = (relevant.length > 0 ? relevant : scored.map((r) => r.s)).slice(0, 3);

  if (QUIZ_RE.test(t)) {
    return pool.map((s) => `Quiz me on ${s.name}`);
  }
  if (SUMMARY_RE.test(t)) {
    return pool.map((s) => `Summarize ${s.name}`);
  }
  if (FLASHCARD_RE.test(t)) {
    return pool.map((s) => `Flashcards for ${s.name}`);
  }
  if (REVIEW_RE.test(t)) {
    // Ambiguous study-help phrasing ("review me on…") → suggest the concrete
    // formats; tapping one routes through the smart submit into that chat.
    return pool.map((s) => `Review ${s.name} with a quiz`);
  }

  const base = t.length > 42 ? `${t.slice(0, 42).trim()}…` : t;
  const out = relevant.slice(0, 2).map((s) => `Explain ${base} using my ${s.name} notes`);
  out.push(`Explain ${base}`);
  return out.slice(0, 3);
}
