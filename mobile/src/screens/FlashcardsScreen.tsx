import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Pressable } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { ScreenContextBar } from '../components/ScreenContextBar';
import { ClockIcon } from '../components/Icons';
import { FlashcardItem } from '../components/FlashcardItem';
import { Flashcard } from '../types';
import { generateFlashcards, getFlashcards, FlashcardAPI, updateFlashcardMastery } from '../api/client';
import { addMemoryEntry } from '../storage/subjectMemory';

interface FlashcardsScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  subjectId?: number;
  subjectName?: string;
  deckTitle?: string;
  cardCount?: number;
  focus?: 'definitions' | 'concepts' | 'qa';
  sourceMaterialId?: number | 'all';
  // Universal back (Flashcards is always a pushed screen).
  onBack?: () => void;
  hideLeft?: boolean;
}

function apiToFlashcard(api: FlashcardAPI, idx: number, total: number, deckTitle: string, subjectCode: string): Flashcard {
  return {
    id: String(api.id ?? idx),
    deckTitle: api.deck_title || deckTitle,
    subjectCode,
    cardNumber: idx + 1,
    totalCards: total,
    term: api.term,
    definition: api.definition,
    hint: api.hint,
  };
}

export function FlashcardsScreen({
  onOpenMenu,
  onOpenProfile,
  subjectId,
  subjectName,
  deckTitle,
  cardCount,
  focus,
  sourceMaterialId,
  onBack,
  hideLeft,
}: FlashcardsScreenProps) {
  // No subject = no grounded content. NEVER seed demo cards (the old initial
  // state silently showed fake content — audit A2).
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [rawApiCards, setRawApiCards] = useState<FlashcardAPI[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!subjectId) return;
    loadOrGenerateCards();
  }, [subjectId]);

  // A custom config (specific source / count / focus) means we always generate
  // fresh cards instead of reusing stored ones.
  const customConfig =
    (sourceMaterialId !== undefined && sourceMaterialId !== 'all') ||
    cardCount !== undefined ||
    focus !== undefined;

  const loadOrGenerateCards = async () => {
    if (!subjectId) return;
    setIsLoading(true);
    setLoadFailed(false);
    try {
      let apiCards: FlashcardAPI[];
      if (customConfig) {
        const result = await generateFlashcards(subjectId, {
          deckTitle,
          numCards: cardCount ?? 15,
          materialId: sourceMaterialId,
          focus,
        });
        apiCards = result.flashcards;
      } else {
        // Try to load existing flashcards first
        apiCards = await getFlashcards(subjectId);
        if (!apiCards.length) {
          // Generate new flashcards from study materials
          const result = await generateFlashcards(subjectId, { deckTitle, numCards: 15 });
          apiCards = result.flashcards;
        }
      }
      setRawApiCards(apiCards);
      const deck = deckTitle || `${subjectName} Deck`;
      const code = (subjectName || 'SUBJECT').toUpperCase();
      setCards(apiCards.map((c, i) => apiToFlashcard(c, i, apiCards.length, deck, code)));
      setCurrentCardIndex(0);
      if (subjectId) {
        addMemoryEntry({
          type: 'cards',
          subjectId,
          count: apiCards.length,
          title: deck,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (err) {
      // Offline/generation failure = explicit error state, NOT demo cards.
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const card = cards[currentCardIndex] || cards[0];

  const handleNext = async () => {
    // Update mastery for reviewed card
    const raw = rawApiCards[currentCardIndex];
    if (raw?.id) {
      updateFlashcardMastery(raw.id, Math.min(1.0, (raw.mastery_score ?? 0) + 0.2)).catch(() => {});
    }
    if (currentCardIndex < cards.length - 1) setCurrentCardIndex((p) => p + 1);
  };

  const handlePrev = () => {
    if (currentCardIndex > 0) setCurrentCardIndex((p) => p - 1);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header onMenu={onOpenMenu} onProfile={onOpenProfile} hideLeft={hideLeft} />
        <ScreenContextBar onBack={onBack ?? (() => {})} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.brandGreen} />
          <Text style={styles.loadingText}>Generating flashcards from your notes...</Text>
        </View>
      </View>
    );
  }

  // No subject / nothing loaded → guide the user instead of showing demo
  // cards (audit A2). Flashcards are built from a subject's notes.
  if (!subjectId || loadFailed || cards.length === 0) {
    return (
      <View style={styles.container}>
        <Header onMenu={onOpenMenu} onProfile={onOpenProfile} hideLeft={hideLeft} />
        <ScreenContextBar onBack={onBack ?? (() => {})} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {loadFailed ? 'Couldn’t load your cards' : 'Pick a subject first'}
          </Text>
          <Text style={styles.emptyText}>
            {loadFailed
              ? 'We couldn’t reach the server or generate cards. Check your connection and try again.'
              : 'Flashcards are built from a subject’s notes. Open a subject and start a deck from there.'}
          </Text>
          <Pressable
            accessibilityLabel={loadFailed ? 'Try again' : 'Back to subjects'}
            onPress={() => {
              if (loadFailed) loadOrGenerateCards();
              else onBack?.();
            }}
            style={({ pressed }) => [styles.emptyButton, pressed && styles.emptyButtonPressed]}
          >
            <Text style={styles.emptyButtonText}>
              {loadFailed ? 'Try again' : 'Back to subjects'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onMenu={onOpenMenu} onProfile={onOpenProfile} hideLeft={hideLeft} />
      <ScreenContextBar onBack={onBack ?? (() => {})} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subjectTag}>{card.subjectCode}</Text>
        <Text style={styles.deckTitle}>{card.deckTitle}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.cardCounter}>Card {card.cardNumber} of {card.totalCards}</Text>
          <View style={styles.timerGroup}>
            <ClockIcon size={14} color={colors.textMuted} />
            <Text style={styles.timerText}>12:45</Text>
          </View>
        </View>

        <FlashcardItem card={card} onNext={handleNext} onPrev={handlePrev} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 36 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontFamily: typography.serifBold, fontSize: 24, lineHeight: 32, color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  emptyText: { fontFamily: typography.sansRegular, fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center', marginBottom: 16 },
  emptyButton: { height: 48, borderRadius: 24, backgroundColor: colors.inkButton, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyButtonPressed: { opacity: 0.85 },
  emptyButtonText: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.surface },
  subjectTag: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, textAlign: 'center', marginBottom: 8 },
  deckTitle: { fontFamily: typography.serifBold, fontSize: 32, lineHeight: 40, color: colors.textPrimary, textAlign: 'center', marginBottom: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight, marginBottom: 24 },
  cardCounter: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted },
  timerGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { fontFamily: typography.sansMedium, fontSize: 13, color: colors.textMuted },
});
