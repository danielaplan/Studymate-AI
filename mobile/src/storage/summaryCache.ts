import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SummaryAPI } from '../api/client';

// Device-persistent summary cache (one entry per subject, keyed by source count).
// Replaces the old in-memory Map so a generated summary survives app
// refresh/restart — reopening a subject after a summary never re-burns AI quota.
// Mirrors the suggestion card's AsyncStorage pattern.
export interface CachedSummary {
  summary: SummaryAPI;
  sourceCount: number;
}

const keyFor = (subjectId: number) => `studymate_summary_${subjectId}`;

export async function getCachedSummary(subjectId: number): Promise<CachedSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(subjectId));
    return raw ? (JSON.parse(raw) as CachedSummary) : null;
  } catch {
    return null;
  }
}

export async function setCachedSummary(subjectId: number, entry: CachedSummary): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(subjectId), JSON.stringify(entry));
  } catch {
    /* cache write is best-effort */
  }
}

export async function clearCachedSummary(subjectId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(subjectId));
  } catch {
    /* best-effort */
  }
}
