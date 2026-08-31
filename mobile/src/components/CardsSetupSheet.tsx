import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { colors, typography } from '../theme';
import { MaterialAPI } from '../api/client';
import { CloseIcon } from './Icons';
import { IconButton } from './IconButton';

export interface CardsPrefs {
  source: number | 'all';
  cardCount: number;
  focus: 'definitions' | 'concepts' | 'qa';
}

interface CardsSetupSheetProps {
  visible: boolean;
  subjectId?: number;
  subjectName?: string;
  materials: MaterialAPI[];
  onClose: () => void;
  onStart: (prefs: CardsPrefs) => void;
}

const COUNT_OPTIONS = [5, 10, 15, 20];
const FOCUS_OPTIONS: { label: string; value: CardsPrefs['focus'] }[] = [
  { label: 'Definitions', value: 'definitions' },
  { label: 'Concepts', value: 'concepts' },
  { label: 'Q & A', value: 'qa' },
];

export function CardsSetupSheet({ visible, subjectId, subjectName, materials, onClose, onStart }: CardsSetupSheetProps) {
  const [source, setSource] = useState<number | 'all'>('all');
  const [cardCount, setCardCount] = useState<number>(15);
  const [focus, setFocus] = useState<CardsPrefs['focus']>('definitions');

  // Reset to defaults each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSource('all');
      setCardCount(15);
      setFocus('definitions');
    }
  }, [visible]);

  if (!visible) return null;

  const sourceOptions: (number | 'all')[] = ['all', ...materials.map((m) => m.id)];

  return (
    <View style={styles.backdrop}>
      <Pressable style={styles.backdropTouch} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Create Flashcards</Text>
          <IconButton onPress={onClose} accessibilityLabel="Close" icon={<CloseIcon size={18} color={colors.textPrimary} />} />
        </View>
        <Text style={styles.sheetSub}>
          {subjectName ? `From “${subjectName}”${subjectId ? '' : ''}` : 'From your study materials'}
        </Text>

        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>SOURCE</Text>
            <View style={styles.chipRow}>
              {sourceOptions.map((opt) => {
                const active = opt === source;
                return (
                  <Pressable
                    key={String(opt)}
                    accessibilityLabel={`Source ${opt === 'all' ? 'All materials' : (materials.find((m) => m.id === opt)?.filename ?? opt)}`}
                    onPress={() => setSource(opt)}
                    style={({ pressed }) => [styles.choiceChip, active && styles.choiceChipActive, pressed && styles.choiceChipPressed]}
                  >
                    <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                      {opt === 'all' ? 'All materials' : (materials.find((m) => m.id === opt)?.filename ?? `Material ${opt}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NUMBER OF CARDS</Text>
            <View style={styles.chipRow}>
              {COUNT_OPTIONS.map((opt) => {
                const active = opt === cardCount;
                return (
                  <Pressable
                    key={opt}
                    accessibilityLabel={`Cards ${opt}`}
                    onPress={() => setCardCount(opt)}
                    style={({ pressed }) => [styles.choiceChip, active && styles.choiceChipActive, pressed && styles.choiceChipPressed]}
                  >
                    <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>FOCUS</Text>
            <View style={styles.chipRow}>
              {FOCUS_OPTIONS.map((opt) => {
                const active = opt.value === focus;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityLabel={`Focus ${opt.label}`}
                    onPress={() => setFocus(opt.value)}
                    style={({ pressed }) => [styles.choiceChip, active && styles.choiceChipActive, pressed && styles.choiceChipPressed]}
                  >
                    <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <Pressable
          accessibilityLabel="Create cards"
          onPress={() => onStart({ source, cardCount, focus })}
          style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}
        >
          <Text style={styles.createButtonText}>Create Cards</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 24, 20, 0.45)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: '82%',
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderLight, marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { fontFamily: typography.display, fontSize: 22, color: colors.textPrimary },
  sheetSub: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted, marginBottom: 16 },
  sheetScroll: { maxHeight: 360 },
  field: { marginBottom: 18 },
  fieldLabel: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  choiceChipActive: { backgroundColor: colors.brandGreen, borderColor: colors.brandGreen },
  choiceChipPressed: { opacity: 0.75 },
  choiceChipText: { fontFamily: typography.sansMedium, fontSize: 13, color: colors.textPrimary },
  choiceChipTextActive: { fontFamily: typography.sansSemiBold, fontSize: 13, color: colors.background },
  createButton: {
    marginTop: 8,
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
  createButtonPressed: { opacity: 0.9 },
  createButtonText: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.background },
});
