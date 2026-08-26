import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography } from '../theme';
import { SubjectItem } from '../types';
import { MasteryProgressBar } from './MasteryProgressBar';
import { MoreVerticalIcon } from './Icons';

interface SubjectCardProps {
  subject: SubjectItem;
  onPress: () => void;
  onOptionsPress?: () => void;
}

export function SubjectCard({ subject, onPress, onOptionsPress }: SubjectCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Subject ${subject.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{subject.name}</Text>
          <Pressable
            accessibilityLabel="Subject options"
            onPress={onOptionsPress}
            style={styles.optionsButton}
          >
            <MoreVerticalIcon size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.materialsText}>{subject.materialsCount} materials</Text>
          <MasteryProgressBar percentage={subject.mastery} width={80} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  content: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: typography.serifSemiBold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  optionsButton: {
    padding: 6,
    marginRight: -6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  materialsText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
});
