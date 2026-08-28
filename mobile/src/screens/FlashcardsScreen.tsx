import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
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
}

const FALLBACK_CARDS: Flashcard[] = [
  { id: '1', deckTitle: 'Network Architecture Deck', subjectCode: 'COMPUTER SCIENCE 101', cardNumber: 1, totalCards: 4, term: 'OSI Model', definition: 'A 7-layer conceptual framework that standardizes network communication functions (Physical → Application).' },
  { id: '2', deckTitle: 'Network Architecture Deck', subjectCode: 'COMPUTER SCIENCE 101', cardNumber: 2, totalCards: 4, term: 'TCP vs. UDP', definition: 'TCP is connection-oriented with reliable delivery. UDP is connectionless, prioritizing speed over reliability.' },
  { id: '3', deckTitle: 'Network Architecture Deck', subjectCode: 'COMPUTER SCIENCE 101', cardNumber: 3, totalCards: 4, term: 'Subnetting', definition: 'Dividing a network into smaller logical subnetworks to improve routing and security.' },
  { id: '4', deckTitle: 'Network Architecture Deck', subjectCode: 'COMPUTER SCIENCE 101', cardNumber: 4, totalCards: 4, term: 'Protocol Hierarchy', definition: 'Structured arrangement where each layer encapsulates data and provides services to the layer above it.' },
];

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
}: FlashcardsScreenProps) {
  const [cards, setCards] = useState<Flashcard[]>(FALLBACK_CARDS);
  const [rawApiCards, setRawApiCards] = useState<FlashcardAPI[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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
      // Fallback to demo cards
      setCards(FALLBACK_CARDS);
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
        <Header onMenu={onOpenMenu} onProfile={onOpenProfile} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.brandGreen} />
          <Text style={styles.loadingText}>Generating flashcards from your notes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onMenu={onOpenMenu} onProfile={onOpenProfile} />
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
  subjectTag: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, textAlign: 'center', marginBottom: 8 },
  deckTitle: { fontFamily: typography.serifBold, fontSize: 32, lineHeight: 40, color: colors.textPrimary, textAlign: 'center', marginBottom: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight, marginBottom: 24 },
  cardCounter: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted },
  timerGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { fontFamily: typography.sansMedium, fontSize: 13, color: colors.textMuted },
});
