import React from 'react';
import { Text, StyleSheet, Pressable, ViewStyle, TextStyle } from 'react-native';
import { colors, typography } from '../theme';

interface QuickActionPillProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  variant?: 'outline' | 'filled';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function QuickActionPill({
  label,
  onPress,
  icon,
  variant = 'outline',
  style,
  textStyle,
}: QuickActionPillProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'filled' ? styles.filled : styles.outline,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.text,
          variant === 'filled' ? styles.filledText : styles.outlineText,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: 'transparent',
  },
  filled: {
    backgroundColor: colors.inkButton,
  },
  text: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
  },
  outlineText: {
    color: colors.textPrimary,
  },
  filledText: {
    color: colors.surface,
    fontFamily: typography.sansMedium,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
