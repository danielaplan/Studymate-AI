import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { colors, typography } from '../theme';

interface OnboardingScreenProps {
  onContinue: () => void;
  onSkip: () => void;
}

export function OnboardingScreen({ onContinue, onSkip }: OnboardingScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Respect Reduce Motion: skip the fade/slide intro, jump to final state.
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        fadeAnim.setValue(1);
        slideAnim.setValue(0);
        return;
      }
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.contentContainer}>
        <View style={styles.illustrationGlow} />
        <View style={styles.illustrationCard}>
          <Svg width={200} height={200} viewBox="0 0 200 200" fill="none">
            <Circle cx="100" cy="100" r="82" fill="#EEF7EA" />
            <Circle cx="78" cy="84" r="46" fill="#D6E5CF" opacity={0.9} />
            <Rect x="98" y="72" width="54" height="72" rx="22" fill="#8DA989" opacity={0.92} />
            <Circle cx="124" cy="136" r="24" fill="#5A7556" />
            <Path
              d="M76 103C86 98 112 98 124 103M75 115C88 110 110 110 124 115"
              stroke="#FBFBF7"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </Svg>
        </View>

        <View style={styles.textGroup}>
          <Text style={styles.eyebrow}>PERSONAL STUDY AI</Text>
          <Text style={styles.heading}>Learn from your own notes, beautifully.</Text>
          <Text style={styles.subheading}>
            Turn PDFs, images, and lecture notes into grounded answers, summaries, quizzes, and flashcards.
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
      </View>
    </Animated.View>
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
    gap: 40,
  },
  illustrationGlow: {
    position: 'absolute',
    top: 54,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#F0F4ED',
  },
  illustrationCard: {
    width: 230,
    height: 230,
    backgroundColor: '#F5F3EE',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    zIndex: 2,
  },
  textGroup: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 10,
    zIndex: 2,
  },
  eyebrow: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.textMuted,
  },
  heading: {
    fontFamily: typography.display,
    fontSize: 36,
    lineHeight: 42,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -1,
  },
  subheading: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    lineHeight: 25,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  bottomActionGroup: {
    alignItems: 'center',
    gap: 18,
    width: '100%',
  },
  continueButton: {
    width: '100%',
    height: 58,
    backgroundColor: colors.inkButton,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  continueButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  continueButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.surface,
    letterSpacing: 0.4,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  skipButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
});
