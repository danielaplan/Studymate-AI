import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { listMaterials, MaterialAPI } from '../api/client';

export interface QuizPrefs {
  source: number | 'all';
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number | null;
}

interface QuizSetupScreenProps {
  subjectId?: number;
  subjectName?: string;
  onClose: () => void;
  onStart: (prefs: QuizPrefs) => void;
}

const COUNT_OPTIONS = [5, 10, 15, 20];
const DIFFICULTY_OPTIONS: QuizPrefs['difficulty'][] = ['easy', 'medium', 'hard'];
const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Off', value: null },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
];

function ChipGroup<T extends number | string>({
  label,
  options,
  selected,
  onSelect,
  formatLabel,
}: {
  label: string;
  options: T[];
  selected: T;
  onSelect: (v: T) => void;
  formatLabel?: (v: T) => string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const active = opt === selected;
          return (
            <Pressable
              key={String(opt)}
              accessibilityLabel={`${label} ${formatLabel ? formatLabel(opt) : String(opt)}`}
              onPress={() => onSelect(opt)}
              style={({ pressed }) => [styles.choiceChip, active && styles.choiceChipActive, pressed && styles.choiceChipPressed]}
            >
              <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                {formatLabel ? formatLabel(opt) : String(opt)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function QuizSetupScreen({ subjectId, subjectName, onClose, onStart }: QuizSetupScreenProps) {
  const [materials, setMaterials] = useState<MaterialAPI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<number | 'all'>('all');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<QuizPrefs['difficulty']>('medium');
  const [timeLimit, setTimeLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    setIsLoading(true);
    listMaterials(subjectId)
      .then((data) => {
        if (!cancelled) setMaterials(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const sourceOptions: (number | 'all')[] = ['all', ...materials.map((m) => m.id)];

  return (
    <View style={styles.container}>
      <Header showClose onClose={onClose} title="QUIZ SETUP" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Build your quiz</Text>
        <Text style={styles.subheading}>
          {subjectName ? `From “${subjectName}” study materials` : 'From your study materials'}
        </Text>

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.brandGreen} size="small" />
            <Text style={styles.loadingText}>Loading your materials…</Text>
          </View>
        ) : (
          <ChipGroup
            label="SOURCE"
            options={sourceOptions}
            selected={source}
            onSelect={setSource}
            formatLabel={(v) => (v === 'all' ? 'All materials' : materials.find((m) => m.id === v)?.filename ?? `Material ${v}`)}
          />
        )}

        <ChipGroup label="NUMBER OF QUESTIONS" options={COUNT_OPTIONS} selected={questionCount} onSelect={setQuestionCount} />

        <ChipGroup
          label="DIFFICULTY"
          options={DIFFICULTY_OPTIONS}
          selected={difficulty}
          onSelect={setDifficulty}
          formatLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
        />

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>TIME LIMIT</Text>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((opt) => {
              const active = opt.value === timeLimit;
              return (
                <Pressable
                  key={opt.label}
                  accessibilityLabel={`Time limit ${opt.label}`}
                  onPress={() => setTimeLimit(opt.value)}
                  style={({ pressed }) => [styles.choiceChip, active && styles.choiceChipActive, pressed && styles.choiceChipPressed]}
                >
                  <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="Start quiz"
          onPress={() => onStart({ source, questionCount, difficulty, timeLimit })}
          style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
        >
          <Text style={styles.startButtonText}>Start Quiz</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  heading: { fontFamily: typography.display, fontSize: 26, color: colors.textPrimary, marginBottom: 4 },
  subheading: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.textMuted, marginBottom: 24 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  loadingText: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted },
  field: { marginBottom: 22 },
  fieldLabel: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  choiceChipActive: {
    backgroundColor: colors.brandGreen,
    borderColor: colors.brandGreen,
  },
  choiceChipPressed: { opacity: 0.75 },
  choiceChipText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  choiceChipTextActive: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: colors.background,
  },
  footer: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.borderLight },
  startButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  startButtonPressed: { opacity: 0.9 },
  startButtonText: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.background },
});
