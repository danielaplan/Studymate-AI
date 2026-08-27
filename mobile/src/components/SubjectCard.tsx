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
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: '#F9F8F4',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    marginBottom: 12,
  },
  content: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: typography.display,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  optionsButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    opacity: 0.74,
  },
});
