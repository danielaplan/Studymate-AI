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
}

export interface SummaryDocument {
  id: string;
  subjectTag: string;
  title: string;
  subtitle: string;
  overviewParagraphs: string[];
  keyTerms?: { term: string; explanation: string }[];
}
