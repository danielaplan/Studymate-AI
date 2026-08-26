import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

interface MasteryProgressBarProps {
  percentage: number;
  showText?: boolean;
  width?: number | string;
}

export function MasteryProgressBar({
  percentage,
  showText = true,
  width = 96,
}: MasteryProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percentage));

  return (
    <View style={styles.container}>
      {showText && (
        <Text style={styles.percentageText}>{clamped}% Mastery</Text>
      )}
      <View style={[styles.track, typeof width === 'number' ? { width } : { width: '100%' }]}>
        <View style={[styles.fill, { width: `${clamped}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  percentageText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  track: {
    height: 4,
    backgroundColor: '#E5E7E2',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: colors.brandGreen,
    borderRadius: 2,
  },
});
