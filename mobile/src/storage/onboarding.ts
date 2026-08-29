import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'studymate_onboarding_complete';

// In-memory fallback for when native storage is unavailable (e.g. Expo Go
// without a dev build). Mirrors the pattern in quizHistory.ts / subjectMemory.ts.
let cached: boolean | null = null;

export async function hasCompletedOnboarding(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cached = raw === 'true';
    return cached;
  } catch {
    return false;
  }
}

export async function setOnboardingComplete(): Promise<void> {
  cached = true;
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    // Storage unavailable — in-session flag already set.
  }
}
