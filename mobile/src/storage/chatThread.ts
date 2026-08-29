import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../types';

// Durable per-subject chat thread (audit B2): stores the FULL ChatMessage[]
// — text bubbles, inline summary cards, launcher cards, and in-progress setup
// questions — so switching tabs (which unmounts ChatScreen) or restarting the
// app never loses the conversation. Distinct from subjectMemory's 'chat'
// entries, which are plain-text records for the notebook/recap panel.
//
// Scope-aware key (Subject Workspace, 2026-08-30): a narrowed source selection
// (some materials toggled off) is its own durable thread, separate from the
// whole-subject thread. All sources active -> `studymate_chat_thread_${id}`
// (unchanged); narrowed -> `..._${id}_${sortedMaterialIds}`. A per-subject index
// of scope hashes lets clearChatThread wipe every variant on subject delete.

const baseKeyFor = (subjectId: number) => `studymate_chat_thread_${subjectId}`;
const scopesIndexKey = (subjectId: number) => `studymate_chat_thread_scopes_${subjectId}`;

// Stable hash of an active-source set: sorted + joined so the same set of
// materials always maps to the same key regardless of toggle order.
const scopeHash = (materialIds?: number[]): string =>
  materialIds && materialIds.length > 0
    ? materialIds
        .slice()
        .sort((a, b) => a - b)
        .join('_')
    : '';

const keyFor = (subjectId: number, materialIds?: number[]): string => {
  const hash = scopeHash(materialIds);
  return hash ? `${baseKeyFor(subjectId)}_${hash}` : baseKeyFor(subjectId);
};

// In-memory cache so the feature still works within a session if the native
// module is unavailable (e.g. Expo Go without a dev build).
const cache: Record<string, ChatMessage[]> = {};

async function recordScope(subjectId: number, hash: string): Promise<void> {
  if (!hash) return;
  try {
    const raw = await AsyncStorage.getItem(scopesIndexKey(subjectId));
    const arr: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!arr.includes(hash)) {
      arr.push(hash);
      await AsyncStorage.setItem(scopesIndexKey(subjectId), JSON.stringify(arr));
    }
  } catch {
    // Index is best-effort; the thread key itself is still correct.
  }
}

export async function loadChatThread(subjectId: number, materialIds?: number[]): Promise<ChatMessage[]> {
  const key = keyFor(subjectId, materialIds);
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    cache[key] = parsed;
    return parsed;
  } catch {
    return cache[key] || [];
  }
}

export async function saveChatThread(subjectId: number, messages: ChatMessage[], materialIds?: number[]): Promise<void> {
  const key = keyFor(subjectId, materialIds);
  cache[key] = messages;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(messages));
    const hash = scopeHash(materialIds);
    if (hash) await recordScope(subjectId, hash);
  } catch {
    // Keep in cache for this session.
  }
}

// Remove a deleted subject's thread (wired into the same delete cleanup as
// clearSubjectMemory / clearQuizHistoryForSubject — issue #2 pattern). Wipes the
// base thread AND every narrowed-scope variant recorded in the index.
export async function clearChatThread(subjectId: number): Promise<void> {
  const baseKey = baseKeyFor(subjectId);
  cache[baseKey] = [];
  try {
    await AsyncStorage.removeItem(baseKey);
    const raw = await AsyncStorage.getItem(scopesIndexKey(subjectId));
    const arr: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    for (const h of arr) {
      const k = `${baseKeyFor(subjectId)}_${h}`;
      delete cache[k];
      await AsyncStorage.removeItem(k);
    }
    await AsyncStorage.removeItem(scopesIndexKey(subjectId));
  } catch {
    // Cache already cleared.
  }
}
