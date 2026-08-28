import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuizAttempt } from '../types';

const KEY = 'studymate_quiz_history';

// In-memory fallback used only when native storage is unavailable (for example,
// running in Expo Go without a dev build). Keeps the feature working within a
// session; the history simply won't survive an app restart in that case.
let memory: QuizAttempt[] = [];

function sortByNewest(list: QuizAttempt[]): QuizAttempt[] {
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function loadQuizHistory(): Promise<QuizAttempt[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as QuizAttempt[]) : [];
    memory = parsed;
    return sortByNewest(parsed);
  } catch {
    return sortByNewest(memory);
  }
}

export async function saveQuizAttempt(attempt: QuizAttempt): Promise<void> {
  const list = await loadQuizHistory();
  list.push(attempt);
  memory = list;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable — keep the attempt in memory for this session.
  }
}

export async function clearQuizHistory(): Promise<void> {
  memory = [];
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Storage unavailable — memory was already cleared.
  }
}

// Remove every quiz-history entry that belongs to a deleted subject so it no
// longer shows up in "Recent quizzes" after the subject is gone.
export async function clearQuizHistoryForSubject(subjectId: number): Promise<void> {
  const list = await loadQuizHistory();
  const remaining = list.filter((a) => a.subjectId !== subjectId);
  memory = remaining;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  } catch {
    // Storage unavailable — memory fallback was already updated.
  }
}
