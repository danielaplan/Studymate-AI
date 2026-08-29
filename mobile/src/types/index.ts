import { SummaryAPI } from '../api/client';

export type ScreenName =
  | 'onboarding'
  | 'home'
  | 'chat'
  | 'subjects'
  | 'subject-detail'
  | 'flashcards'
  | 'summary'
  | 'quiz'
  | 'quiz-setup'
  | 'quiz-result'
  | 'profile';

export type TabName = 'home' | 'subjects' | 'chat' | 'profile';

export interface SubjectItem {
  id: string;
  name: string;
  materialsCount: number;
  mastery: number | null; // 0 - 100, or null if not yet assessed
  description?: string;
  lastStudied?: string;
  pinned?: boolean;
}

// Per-topic mastery used by the Subject Detail "Focus areas" section.
export interface FocusArea {
  topic: string;
  mastery: number; // 0 - 100
}

// Overall + per-topic mastery returned by the backend mastery endpoint.
export interface MasteryDetail {
  overall: number | null; // 0 - 100, or null if not yet assessed
  assessed: boolean;
  byTopic: FocusArea[];
}

export interface Flashcard {
  id: string;
  deckTitle: string;
  subjectCode: string;
  cardNumber: number;
  totalCards: number;
  term: string;
  definition: string;
  hint?: string;
}

export interface QuizQuestion {
  id: string;
  topic: string;
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface QuizAnswer {
  selected: number | null;
  correct: number;
  isCorrect: boolean;
}

export interface QuizAttempt {
  id: string;
  subjectId: number | null;
  subjectName: string;
  score: number;
  total: number;
  pct: number;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  count: number;
  createdAt: string; // ISO timestamp
  questions: QuizQuestion[];
  answers: QuizAnswer[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  materialTag?: string;
  bulletPoints?: { title: string; content: string }[];
  summary?: SummaryAPI;
  // Artifact classification: when set, the message renders as an AIArtifactCard
  // (not a plain bubble). 'chat' messages stay as normal chat bubbles.
  artifactType?: 'summary' | 'quiz' | 'flashcards';
  // Structured payload backing the artifact card (lead/body/details). Present for
  // summary/quiz/flashcards messages; absent for plain chat.
  artifact?: ArtifactPayload;
  // Chat-hub launcher card: a ready-to-open quiz or flashcard deck. Tapping the
  // button hands off to the existing QuizScreen / FlashcardsScreen with prefs.
  action?: ChatAction;
  // Chat-hub conversational setup question (asked in-thread, chips inline).
  setup?: ChatSetupQuestion;
}

// Payload rendered by AIArtifactCard. `details` is the collapsible richer
// content (key terms, questions, or cards) kept out of the lead/body skim.
export interface ArtifactPayload {
  lead: string;
  body: string;
  details?: {
    title: string;
    items: { term?: string; text: string }[];
  };
  sourceChunks?: number[];
}

// Launcher card payload rendered inside a chat bubble (chat-hub feature).
export interface ChatAction {
  kind: 'quiz' | 'flashcards';
  label: string; // e.g. "10-question hard quiz on Neuro Week 3"
  // Quiz prefs (when kind === 'quiz')
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number | null; // minutes, or null = off (added 2026-08-28)
  // Flashcard prefs (when kind === 'flashcards')
  cardCount?: number;
  focus?: 'definitions' | 'concepts' | 'qa';
}

// One setup question asked CONVERSATIONALLY inside the chat thread (chat-hub
// feature, user feedback 2026-08-28: setup must feel like a chat conversation,
// not a bar above the input). Lives on the AI message that asks it; the chips
// render only while that message is the LAST one (i.e. still unanswered).
// Tapping a chip strips `setup` (question answered) and records the answer as
// the user's own bubble.
export interface ChatSetupQuestion {
  kind: 'quiz' | 'flashcards';
  // 'choice' is the ambiguous-request stage (user said "review me" without
  // naming a format): offer Quiz / Flashcards / Summary. Then quiz:
  // count -> difficulty -> time; flashcards: count -> focus.
  stage: 'choice' | 'count' | 'difficulty' | 'time' | 'focus';
  // Answers collected on previous turns, carried forward stage by stage.
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard'; // carried into the quiz 'time' stage
}

// ---------------------------------------------------------------------------
// Guided create-subject thread (Slice 4 remainder — decisions 4/5/7, guards
// C/D/E/K, M1–M6). When a NEW source is attached (its content_hash belongs to
// no subject yet), the smart box expands into a mini chat thread that asks,
// one at a time: name → scope → output. It then creates the subject from that
// file and hands off to grounded chat. State is LIFTED to App level (M1) so it
// survives screen unmount; answers are captured with structured inputs (text
// field for name, chips for scope/output) — never per-turn LLM parsing (M2).
// ---------------------------------------------------------------------------

// One question per turn, in this fixed order (decision 5).
export type GuidedStage = 'name' | 'scope' | 'output';

// Scope: study the whole document, or just a section the user names (decision 5b).
export type GuidedScope = 'whole' | 'section';

// Output: which first-class deliverable to steer toward (decision 5c). 'chat'
// is the default grounded-chat handoff; the others pre-fill a chat prompt that
// asks for that deliverable so the user still reviews + sends (decision 6).
export type GuidedOutput = 'guide' | 'quiz' | 'flashcards' | 'chat';

// Minimal, serializable view of a picked file so the guided state can live in
// App without importing expo-document-picker types into the shared types file.
export interface GuidedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  // Web-only Blob handle from expo-document-picker (`(asset as any).file`).
  webFile?: unknown;
}

export interface GuidedCapture {
  stage: GuidedStage;
  file: GuidedFile;
  // AI-suggested subject name, used to pre-fill the name field.
  suggestedName: string;
  // Answers collected so far (null until that turn is answered).
  name: string | null;
  scope: GuidedScope | null;
  // When scope === 'section', the section the user typed.
  section: string | null;
  output: GuidedOutput | null;
  // content_hash of the file (guard E/K) — lets the final create step dedupe.
  contentHash: string;
}

export interface SummaryDocument {
  id: string;
  subjectTag: string;
  title: string;
  subtitle: string;
  overviewParagraphs: string[];
  keyTerms?: { term: string; explanation: string }[];
}
