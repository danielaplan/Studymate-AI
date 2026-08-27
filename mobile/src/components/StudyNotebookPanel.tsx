import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';
import { FolderIcon, SparklesIcon } from './Icons';

export interface NotebookMaterialItem {
  title: string;
  status?: 'ready' | 'processing' | 'failed';
  count?: number;
}

interface StudyNotebookPanelProps {
  subjectName: string;
  materials: NotebookMaterialItem[];
  onSelectMaterial?: (title: string) => void;
  onQuickAction?: (prompt: string) => void;
}

const quickActions = [
  { label: 'Explain', prompt: 'Explain the main ideas in this material in simple terms.' },
  { label: 'Quiz', prompt: 'Create a short quiz from these notes and test my understanding.' },
  { label: 'Cards', prompt: 'Turn the key concepts in this material into flashcards.' },
  { label: 'Summary', prompt: 'Summarize the most important points from these notes.' },
];

export function StudyNotebookPanel({ subjectName, materials, onSelectMaterial, onQuickAction }: StudyNotebookPanelProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <FolderIcon size={15} color={colors.brandGreen} />
          <Text style={styles.headerTitle}>Notebook sources</Text>
        </View>
        <Text style={styles.subjectTag}>{subjectName.toUpperCase()}</Text>
      </View>

      <View style={styles.materialRow}>
        {materials.length > 0 ? (
          materials.slice(0, 3).map((material) => (
            <Pressable
              key={material.title}
              accessibilityLabel={`Focus on ${material.title}`}
              onPress={() => onSelectMaterial?.(material.title)}
              style={({ pressed }) => [styles.materialPill, pressed && styles.pressed]}
            >
              <Text style={styles.materialTitle} numberOfLines={1}>{material.title}</Text>
              <View
                style={[
                  styles.statusDot,
                  material.status === 'ready' && styles.statusReady,
                  material.status === 'processing' && styles.statusProcessing,
                  material.status === 'failed' && styles.statusFailed,
                  !material.status && styles.statusReady,
                ]}
              />
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyText}>Upload notes to build a study notebook.</Text>
        )}
      </View>

      <View style={styles.actionRow}>
        {quickActions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityLabel={action.label}
            onPress={() => onQuickAction?.(action.prompt)}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <SparklesIcon size={14} color={colors.brandGreen} />
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F6F1',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    gap: 14,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  subjectTag: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.brandGreen,
    backgroundColor: colors.brandGreenSoft,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  materialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  materialPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  materialTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
    maxWidth: 150,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusReady: { backgroundColor: colors.success },
  statusProcessing: { backgroundColor: colors.warning },
  statusFailed: { backgroundColor: colors.error },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  emptyText: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.75,
  },
});
