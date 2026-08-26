import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle, Rect, Path, G } from 'react-native-svg';
import { colors, typography } from '../theme';

interface OnboardingScreenProps {
  onContinue: () => void;
  onSkip: () => void;
}

export function OnboardingScreen({ onContinue, onSkip }: OnboardingScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Minimalist Organic Art */}
        <View style={styles.illustrationCard}>
          <Svg width={180} height={180} viewBox="0 0 200 200" fill="none">
            {/* Background subtle elements */}
            <Circle cx="100" cy="100" r="80" fill="#EDF3E8" />
            <Circle cx="80" cy="85" r="45" fill="#C5D9BD" opacity={0.8} />
            <Rect x="100" y="70" width="60" height="75" rx="30" fill="#8EA883" opacity={0.9} />
            <Circle cx="125" cy="135" r="22" fill="#58754E" />
            {/* Subtle study motif */}
            <Path
              d="M75 105C85 100 115 100 125 105M75 115C85 110 115 110 125 115"
              stroke="#FAFAF4"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </Svg>
        </View>

        <View style={styles.textGroup}>
          <Text style={styles.heading}>Welcome to{'\n'}StudyMate AI</Text>
          <Text style={styles.subheading}>
            Study with your own notes. Local AI privacy by design.
          </Text>
        </View>
      </View>

      <View style={styles.bottomActionGroup}>
        <Pressable
          accessibilityLabel="Continue"
          onPress={onContinue}
          style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed]}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>

        <Pressable accessibilityLabel="Skip onboarding" onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </Pressable>

        <View style={styles.paginationDots}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },
  contentContainer: {
    alignItems: 'center',
    gap: 48,
  },
  illustrationCard: {
    width: 240,
    height: 240,
    backgroundColor: '#F3F6EE',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  textGroup: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 12,
  },
  heading: {
    fontFamily: typography.serifBold,
    fontSize: 34,
    lineHeight: 44,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheading: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottomActionGroup: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  continueButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#1E221D',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  continueButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
  paginationDots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D6CB',
  },
  activeDot: {
    backgroundColor: '#1E221D',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
