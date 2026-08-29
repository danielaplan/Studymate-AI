import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';
import { MasteryRing } from './MasteryRing';
import { MasterySparkline } from './MasterySparkline';

interface MasteryHeroProps {
  /** Overall mastery, 0–100. */
  percentage: number;
  /** Number of topics in the set — shown in the subtext. */
  topicCount: number;
  /**
   * Per-session overall mastery %, oldest → newest. Powers the sparkline and the
   * delta chip. When null / <2 points, the sparkline + chip are hidden entirely
   * (no fabricated trend). The app doesn't log session history yet, so today this
   * is passed as `null` and only the ring + label render.
   */
  history?: number[] | null;
}

export function MasteryHero({ percentage, topicCount, history }: MasteryHeroProps) {
  const hasHistory = Array.isArray(history) && history.length >= 2;
  const delta = hasHistory ? history![history!.length - 1] - history![0] : 0;

  return (
    <View style={styles.hero}>
      <MasteryRing percentage={percentage} />

      <View style={styles.heroSide}>
        <Text style={styles.heroLabel}>Overall mastery</Text>
        <Text style={styles.heroSub}>
          Across {topicCount} {topicCount === 1 ? 'topic' : 'topics'} in this set
        </Text>

        {hasHistory && (
          <View style={styles.sparkRow}>
            <MasterySparkline data={history!} />
            <View style={styles.deltaChip}>
              <Text style={styles.deltaText}>
                {delta >= 0 ? '+' : ''}
                {Math.round(delta)}% this month
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: 18,
  },
  heroSide: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  heroLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  heroSub: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.textMuted,
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  deltaChip: {
    backgroundColor: colors.sageBadge,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  deltaText: {
    fontFamily: typography.sansBold,
    fontSize: 10.5,
    color: colors.brandGreen,
  },
});
