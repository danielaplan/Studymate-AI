import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography } from '../theme';
import { SparklesIcon } from './Icons';
import { getStudySuggestion, StudySuggestionAPI } from '../api/client';

interface StudySuggestionCardProps {
  subjectId: number;
  /**
   * Stable signature of the current mastery state. The card only calls the AI
   * when this changes (i.e. after a quiz moves the numbers), so simply opening
   * the workspace re-shows the cached suggestion and spends no AI quota.
   */
  signature: string;
}

const cacheKey = (subjectId: number, sig: string) => `studymate_suggestion_${subjectId}_${sig}`;

export function StudySuggestionCard({ subjectId, signature }: StudySuggestionCardProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StudySuggestionAPI | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signature) return;
    let cancelled = false;
    const key = cacheKey(subjectId, signature);
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1) Serve from cache if this exact mastery state was already analyzed.
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          if (!cancelled) setData(JSON.parse(cached) as StudySuggestionAPI);
          return;
        }
        // 2) Otherwise ask the AI (only fires on a mastery change).
        const res = await getStudySuggestion(subjectId);
        if (cancelled) return;
        if (res.assessed && res.suggestion) {
          await AsyncStorage.setItem(key, JSON.stringify(res));
        }
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load suggestions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subjectId, signature]);

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <SparklesIcon size={16} color={colors.brandGreen} />
          <Text style={styles.overline}>AI SUGGESTION</Text>
        </View>
        <ActivityIndicator size="small" color={colors.brandGreen} style={styles.spinner} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <SparklesIcon size={16} color={colors.textMuted} />
          <Text style={styles.overline}>AI SUGGESTION</Text>
        </View>
        <Text style={styles.errorText}>Suggestions paused — {error}</Text>
      </View>
    );
  }

  if (!data?.suggestion) return null;

  const { headline, items } = data.suggestion;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <SparklesIcon size={16} color={colors.brandGreen} />
        <Text style={styles.overline}>AI SUGGESTION</Text>
      </View>
      {headline ? <Text style={styles.headline}>{headline}</Text> : null}
      {items.map((it, i) => (
        <View key={`${it.topic}-${i}`} style={styles.item}>
          <Text style={styles.itemTopic}>{it.topic}</Text>
          <Text style={styles.itemAdvice}>{it.advice}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  overline: {
    fontFamily: typography.sansBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  headline: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13.5,
    color: colors.textPrimary,
    marginBottom: 10,
    lineHeight: 19,
  },
  item: {
    marginBottom: 10,
  },
  itemTopic: {
    fontFamily: typography.sansBold,
    fontSize: 12.5,
    color: colors.brandGreen,
    marginBottom: 2,
  },
  itemAdvice: {
    fontFamily: typography.sansRegular,
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  spinner: {
    marginVertical: 10,
  },
  errorText: {
    fontFamily: typography.sansRegular,
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
