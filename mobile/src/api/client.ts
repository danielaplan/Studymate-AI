/**
 * API client for StudyMate AI backend.
 * All requests route through the FastAPI RAG pipeline.
 */

import { Platform } from 'react-native';

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
  materials_count: number;
  mastery: number;
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
  apiRequest<MaterialAPI[]>(`/api/subjects/${subjectId}/materials`);

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

export const generateQuiz = (subjectId: number, topicTag?: string, numQuestions = 10) =>
  apiRequest<{ subject: string; questions: QuizQuestionAPI[]; count: number }>(
    `/api/subjects/${subjectId}/quiz`,
    {
      method: 'POST',
      body: JSON.stringify({ topic_tag: topicTag ?? null, num_questions: numQuestions, save_to_db: true }),
    }
  );

export const getQuizQuestions = (subjectId: number) =>
  apiRequest<QuizQuestionAPI[]>(`/api/subjects/${subjectId}/quiz`);

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

export const generateFlashcards = (subjectId: number, deckTitle?: string, numCards = 15) =>
  apiRequest<{ subject: string; deck_title: string; flashcards: FlashcardAPI[]; count: number }>(
    `/api/subjects/${subjectId}/flashcards`,
    {
      method: 'POST',
      body: JSON.stringify({ deck_title: deckTitle ?? null, num_cards: numCards, save_to_db: true }),
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
