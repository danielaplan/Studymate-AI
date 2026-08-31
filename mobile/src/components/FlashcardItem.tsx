import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography } from '../theme';
import { Flashcard } from '../types';

interface FlashcardItemProps {
  card: Flashcard;
  onNext?: () => void;
  onPrev?: () => void;
}

export function FlashcardItem({ card, onNext, onPrev }: FlashcardItemProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const toggleReveal = () => {
    setIsRevealed((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel="Flashcard, tap to reveal answer"
        onPress={toggleReveal}
        style={({ pressed }) => [
          styles.card,
          isRevealed && styles.cardRevealed,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.sideLabel}>{isRevealed ? 'DEFINITION / ANSWER' : 'CONCEPT / TERM'}</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={isRevealed ? styles.definitionText : styles.termText}>
            {isRevealed ? card.definition : card.term}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.tapPrompt}>
            {isRevealed ? '👆 Tap to show term' : '👆 Tap to reveal definition'}
          </Text>
        </View>
      </Pressable>

      <View style={styles.navigationControls}>
        <Pressable
          accessibilityLabel="Previous card"
          onPress={() => {
            setIsRevealed(false);
            onPrev?.();
          }}
          disabled={card.cardNumber <= 1}
          style={({ pressed }) => [
            styles.navButton,
            card.cardNumber <= 1 && styles.navButtonDisabled,
            pressed && styles.navButtonPressed,
          ]}
        >
          <Text style={[styles.navButtonText, card.cardNumber <= 1 && styles.navButtonTextDisabled]}>
            ← Previous
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Next card"
          onPress={() => {
            setIsRevealed(false);
            onNext?.();
          }}
          disabled={card.cardNumber >= card.totalCards}
          style={({ pressed }) => [
            styles.navButton,
            card.cardNumber >= card.totalCards && styles.navButtonDisabled,
            pressed && styles.navButtonPressed,
          ]}
        >
          <Text style={[styles.navButtonText, card.cardNumber >= card.totalCards && styles.navButtonTextDisabled]}>
            Next →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
  },
  card: {
    width: '100%',
    minHeight: 340,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardRevealed: {
    backgroundColor: '#FAFBF8',
    borderColor: colors.brandGreenLight,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    alignItems: 'center',
  },
  sideLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  termText: {
    fontFamily: typography.serifBold,
    fontSize: 32,
    lineHeight: 40,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  definitionText: {
    fontFamily: typography.sansRegular,
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  cardFooter: {
    alignItems: 'center',
  },
  tapPrompt: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textMuted,
  },
  navigationControls: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  navButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  navButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  navButtonTextDisabled: {
    color: colors.textPlaceholder,
  },
});
