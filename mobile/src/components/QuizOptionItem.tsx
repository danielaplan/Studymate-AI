import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography } from '../theme';

interface QuizOptionItemProps {
  text: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function QuizOptionItem({
  text,
  selected,
  onSelect,
  disabled = false,
}: QuizOptionItemProps) {
  return (
    <Pressable
      accessibilityLabel={`Option: ${text}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onSelect}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        selected && styles.containerSelected,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
        {selected && <View style={styles.radioInnerDot} />}
      </View>

      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    gap: 14,
  },
  containerSelected: {
    borderColor: colors.brandGreen,
    backgroundColor: '#F8FAF6',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioCircleSelected: {
    borderColor: colors.brandGreen,
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandGreen,
  },
  optionText: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    fontFamily: typography.sansMedium,
    color: colors.brandGreenDark,
  },
  pressed: {
    opacity: 0.8,
  },
});
