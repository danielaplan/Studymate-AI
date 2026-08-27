export type ScreenName =
  | 'onboarding'
  | 'home'
  | 'chat'
  | 'subjects'
  | 'subject-detail'
  | 'flashcards'
  | 'summary'
  | 'quiz'
  | 'profile';

export type TabName = 'home' | 'subjects' | 'chat' | 'profile';

export interface SubjectItem {
  id: string;
  name: string;
  materialsCount: number;
  mastery: number; // 0 - 100
  description?: string;
  lastStudied?: string;
  pinned?: boolean;
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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  materialTag?: string;
  bulletPoints?: { title: string; content: string }[];
}

export interface SummaryDocument {
  id: string;
  subjectTag: string;
  title: string;
  subtitle: string;
  overviewParagraphs: string[];
  keyTerms?: { term: string; explanation: string }[];
}
