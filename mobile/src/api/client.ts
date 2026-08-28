/**
 * API client for StudyMate AI backend.
 * All requests route through the FastAPI RAG pipeline.
 */

import { Platform } from 'react-native';
import type { MasteryDetail } from '../types';

const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      return `http://${window.location.hostname}:8000`;
    }
    return 'http://localhost:8000';
  }
  if (envUrl) {
    return envUrl;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
};

const API_URL = getBaseUrl();

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${options.method ?? 'GET'} ${path} failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
export interface SubjectAPI {
  id: number;
  name: string;
  description?: string;
  color_tag?: string;
  pinned: boolean;
  materials_count: number;
  mastery: number | null;
}

export const listSubjects = () => apiRequest<SubjectAPI[]>('/api/subjects');

export const createSubject = (name: string, description?: string) =>
  apiRequest<SubjectAPI>('/api/subjects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });

export const deleteSubject = (id: number) =>
  fetch(`${API_URL}/api/subjects/${id}`, { method: 'DELETE' });

// ---------------------------------------------------------------------------
// Global source-match (smart study box, Slice 1 backend)
// ---------------------------------------------------------------------------
export interface SourceMatchResult {
  matched: boolean;
  weak?: boolean;
  subject_id?: number;
  subject_name?: string;
  top_score?: number;
  margin?: number;
}

export const searchSource = (question: string) =>
  apiRequest<SourceMatchResult>('/api/search/source', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });

export interface SubjectUpdate {
  name?: string;
  description?: string;
  color_tag?: string;
  pinned?: boolean;
}

export const updateSubject = (id: number, data: SubjectUpdate) =>
  apiRequest<SubjectAPI>(`/api/subjects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
export interface MaterialAPI {
  id: number;
  filename: string;
  file_type: string;
  file_size_bytes?: number;
  processing_status: string;
  chunks_count: number;
}

export const listMaterials = (subjectId: number) =>
  apiRequest<MaterialAPI[]>(`/api/subjects/${subjectId}/materials`, {
    cache: 'no-store',
  });

export const uploadMaterial = async (
  subjectId: number,
  fileUri: string,
  fileName: string,
  mimeType: string = 'application/pdf',
  fileBlob?: Blob
): Promise<MaterialAPI> => {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    if (fileBlob) {
      formData.append('file', fileBlob, fileName);
    } else {
      const fetchRes = await fetch(fileUri);
      const blob = await fetchRes.blob();
      formData.append('file', blob, fileName);
    }
  } else {
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType || 'application/pdf',
    } as any);
  }

  const res = await fetch(`${API_URL}/api/subjects/${subjectId}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed (${res.status}): ${err}`);
  }
  return res.json();
};

export const deleteMaterial = (materialId: number) =>
  fetch(`${API_URL}/api/materials/${materialId}`, { method: 'DELETE' });

export interface ExtractTextResponse {
  extracted_text: string;
  suggested_title: string;
  file_type: string;
}

// ---------------------------------------------------------------------------
// File reuse check (smart study box guided flow, Slice 4 guard E/K)
// ---------------------------------------------------------------------------
export interface FileReuseCheckResult {
  content_hash: string;
  known: boolean;
  existing_subject_id?: number | null;
  existing_subject_name?: string | null;
  already_processed?: boolean;
}

// Cheap file-identity check: hashes the file server-side and reports whether it
// already belongs to a subject. No AI call, no writes. Runs BEFORE any AI spend
// so a known file can jump straight to its subject's chat (guard K).
export const fileReuseCheck = async (
  fileUri: string,
  fileName: string,
  mimeType: string = 'application/pdf',
  fileBlob?: Blob
): Promise<FileReuseCheckResult> => {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    if (fileBlob) {
      formData.append('file', fileBlob, fileName);
    } else {
      const fetchRes = await fetch(fileUri);
      const blob = await fetchRes.blob();
      formData.append('file', blob, fileName);
    }
  } else {
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType || 'application/pdf',
    } as any);
  }

  const res = await fetch(`${API_URL}/api/files/reuse-check`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Reuse check failed (${res.status}): ${err}`);
  }
  return res.json();
};

export const extractTextAndSuggestTitle = async (fileUri: string, fileName: string, mimeType: string = 'application/pdf', fileBlob?: Blob): Promise<ExtractTextResponse> => {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    if (fileBlob) {
      formData.append('file', fileBlob, fileName);
    } else {
      const fetchRes = await fetch(fileUri);
      const blob = await fetchRes.blob();
      formData.append('file', blob, fileName);
    }
  } else {
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType || 'application/pdf',
    } as any);
  }

  const res = await fetch(`${API_URL}/api/extract-text-and-suggest-title`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Extract text failed (${res.status}): ${err}`);
  }
  return res.json();
};

// ---------------------------------------------------------------------------
// RAG Chat
// ---------------------------------------------------------------------------
export interface ChatResponseAPI {
  reply: string;
  retrieved_chunks_count: number;
  provider: string;
}

export const sendChatMessage = (message: string, subjectId?: number) =>
  apiRequest<ChatResponseAPI>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, subject_id: subjectId ?? null }),
  });

export const getChatHistory = (subjectId: number) =>
  apiRequest<{ id: number; role: string; content: string; created_at: string }[]>(
    `/api/subjects/${subjectId}/chat-history`
  );

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
export interface SummaryAPI {
  title: string;
  subtitle: string;
  overview_paragraphs: string[];
  key_terms: { term: string; explanation: string }[];
  takeaways: string[];
}

export const generateSummary = (subjectId: number, materialId?: number, chapterTitle?: string) =>
  apiRequest<SummaryAPI>(`/api/subjects/${subjectId}/summary`, {
    method: 'POST',
    body: JSON.stringify({ material_id: materialId ?? null, chapter_title: chapterTitle ?? null }),
  });

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------
export interface QuizQuestionAPI {
  id?: number;
  topic: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

export interface QuizGenerateOptions {
  topicTag?: string;
  numQuestions?: number;
  materialId?: number | 'all';
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number | null;
}

export const generateQuiz = (subjectId: number, opts: QuizGenerateOptions = {}) =>
  apiRequest<{ subject: string; questions: QuizQuestionAPI[]; count: number }>(
    `/api/subjects/${subjectId}/quiz`,
    {
      method: 'POST',
      body: JSON.stringify({
        topic_tag: opts.topicTag ?? null,
        num_questions: opts.numQuestions ?? 10,
        difficulty: opts.difficulty ?? null,
        material_id: opts.materialId === 'all' || opts.materialId == null ? null : opts.materialId,
        time_limit: opts.timeLimit ?? null,
        save_to_db: true,
      }),
    }
  );

export const getQuizQuestions = (subjectId: number) =>
  apiRequest<QuizQuestionAPI[]>(`/api/subjects/${subjectId}/quiz`);

// ---------------------------------------------------------------------------
// Quiz attempts & mastery (drives the real mastery scoring system)
// ---------------------------------------------------------------------------

export interface QuizAttemptRecord {
  topic: string;
  correct: boolean;
}

interface MasteryRaw {
  overall: number | null;
  assessed: boolean;
  by_topic: Record<string, number>; // topic -> percentage (0-100)
}

const toMasteryDetail = (raw: MasteryRaw): MasteryDetail => ({
  overall: raw.overall,
  assessed: raw.assessed,
  byTopic: Object.entries(raw.by_topic ?? {}).map(([topic, mastery]) => ({
    topic,
    mastery,
  })),
});

export const recordQuizAttempt = async (
  subjectId: number,
  attempts: QuizAttemptRecord[]
): Promise<MasteryDetail> => {
  const raw = await apiRequest<MasteryRaw>(`/api/subjects/${subjectId}/quiz-attempts`, {
    method: 'POST',
    body: JSON.stringify({ attempts }),
  });
  return toMasteryDetail(raw);
};

export const getSubjectMastery = async (subjectId: number): Promise<MasteryDetail> => {
  const raw = await apiRequest<MasteryRaw>(`/api/subjects/${subjectId}/mastery`);
  return toMasteryDetail(raw);
};

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------
export interface FlashcardAPI {
  id?: number;
  deck_title: string;
  term: string;
  definition: string;
  hint?: string;
  mastery_score?: number;
  times_reviewed?: number;
}

export interface FlashcardGenerateOptions {
  deckTitle?: string;
  numCards?: number;
  materialId?: number | 'all';
  focus?: 'definitions' | 'concepts' | 'qa';
}

export const generateFlashcards = (subjectId: number, opts: FlashcardGenerateOptions = {}) =>
  apiRequest<{ subject: string; deck_title: string; flashcards: FlashcardAPI[]; count: number }>(
    `/api/subjects/${subjectId}/flashcards`,
    {
      method: 'POST',
      body: JSON.stringify({
        deck_title: opts.deckTitle ?? null,
        num_cards: opts.numCards ?? 15,
        material_id: opts.materialId === 'all' || opts.materialId == null ? null : opts.materialId,
        focus: opts.focus ?? null,
        save_to_db: true,
      }),
    }
  );

export const getFlashcards = (subjectId: number) =>
  apiRequest<FlashcardAPI[]>(`/api/subjects/${subjectId}/flashcards`);

export const updateFlashcardMastery = async (flashcardId: number, masteryScore: number): Promise<void> => {
  const formData = new FormData();
  formData.append('mastery_score', String(masteryScore));
  await fetch(`${API_URL}/api/flashcards/${flashcardId}/mastery`, {
    method: 'PATCH',
    body: formData,
  });
};
