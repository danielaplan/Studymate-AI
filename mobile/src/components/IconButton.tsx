import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityState?: { selected?: boolean };
}

/**
 * Shared icon-button primitive. Honors the native touch-target floor
 * (>=44pt iOS / 48dp Android) via a 44x44 tappable frame while keeping the
 * visible glyph at 20-32pt. Replaces the 32x32 icon buttons that failed the
 * audit's accessibility check.
 */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityState,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPress={onPress}
      hitSlop={{ top: 6, left: 6, right: 6, bottom: 6 }}
      style={({ pressed }) => [styles.touch, pressed && styles.pressed]}
    >
      <View style={styles.circle}>{icon}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pressed: {
    opacity: 0.7,
  },
});
