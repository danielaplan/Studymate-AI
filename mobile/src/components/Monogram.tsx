import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

interface MonogramProps {
  size?: number;
  initials?: string;
}

/**
 * Replaces the photographic avatar that previously broke DESIGN.md's
 * "no stock imagery" rule and leaked fabricated PII ("Alex Rivera"). A neutral,
 * green-tinted initial disc — never a real photo, never a hardcoded name.
 * Defaults to the app's initials so no user identity is assumed.
 */
export function Monogram({ size = 32, initials = 'SM' }: MonogramProps) {
  return (
    <View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel="Your profile"
    >
      <Text
        style={[
          styles.initials,
          { fontSize: Math.round(size * 0.4) },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    backgroundColor: colors.brandGreenSoft,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: typography.serifBold,
    fontWeight: '700',
    color: colors.brandGreenDark,
    letterSpacing: 0.5,
  },
});
