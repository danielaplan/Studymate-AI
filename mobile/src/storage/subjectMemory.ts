import AsyncStorage from '@react-native-async-storage/async-storage';

export type MemoryEntryType = 'chat' | 'upload' | 'quiz' | 'summary' | 'cards';

export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  subjectId: number;
  timestamp: string; // ISO
  // chat
  role?: 'user' | 'ai';
  text?: string;
  // upload
  fileName?: string;
  // quiz
  attemptId?: string;
  score?: number;
  total?: number;
  pct?: number;
  // summary / cards
  title?: string;
  count?: number;
}

const keyFor = (subjectId: number) => `studymate_memory_${subjectId}`;

// In-memory cache so the feature still works within a session if the native
// module is unavailable (e.g. Expo Go without a dev build).
const cache: Record<number, MemoryEntry[]> = {};

function sortNewest(list: MemoryEntry[]): MemoryEntry[] {
  return [...list].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

function sortOldest(list: MemoryEntry[]): MemoryEntry[] {
  return [...list].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
}

export async function loadSubjectMemory(subjectId: number): Promise<MemoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(subjectId));
    const parsed = raw ? (JSON.parse(raw) as MemoryEntry[]) : [];
    cache[subjectId] = parsed;
    return sortNewest(parsed);
  } catch {
    return sortNewest(cache[subjectId] || []);
  }
}

export async function loadChatMemory(subjectId: number): Promise<MemoryEntry[]> {
  const all = await loadSubjectMemory(subjectId);
  return sortOldest(all.filter((e) => e.type === 'chat'));
}

export async function addMemoryEntry(
  entry: Omit<MemoryEntry, 'id'> & { id?: string }
): Promise<void> {
  const full: MemoryEntry = {
    id: entry.id ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...entry,
  };
  const list = await loadSubjectMemory(full.subjectId);
  list.push(full);
  cache[full.subjectId] = list;
  try {
    await AsyncStorage.setItem(keyFor(full.subjectId), JSON.stringify(list));
  } catch {
    // Keep in cache for this session.
  }
}

export async function clearSubjectMemory(subjectId: number): Promise<void> {
  cache[subjectId] = [];
  try {
    await AsyncStorage.removeItem(keyFor(subjectId));
  } catch {
    // Ignore — cache already cleared.
  }
}
