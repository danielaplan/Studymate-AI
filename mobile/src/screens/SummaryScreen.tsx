import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { DocumentIcon, SparklesIcon } from '../components/Icons';

interface SummaryScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onCreateQuiz: () => void;
  onCreateFlashcards: () => void;
}

export function SummaryScreen({
  onOpenMenu,
  onOpenProfile,
  onCreateQuiz,
  onCreateFlashcards,
}: SummaryScreenProps) {
  return (
    <View style={styles.container}>
      <Header onMenu={onOpenMenu} onProfile={onOpenProfile} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subject Tag */}
        <View style={styles.tagRow}>
          <Text style={styles.tagText}>📖 BIOLOGY 101</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Cellular{'\n'}Respiration</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          A comprehensive summary of the metabolic processes that convert biochemical energy from nutrients into adenosine triphosphate (ATP).
        </Text>

        {/* Action Chips */}
        <View style={styles.actionChipsRow}>
          <Pressable
            accessibilityLabel="Create Quiz"
            onPress={onCreateQuiz}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <DocumentIcon size={16} color={colors.brandGreen} />
            <Text style={styles.chipText}>Create Quiz</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Create Flashcards"
            onPress={onCreateFlashcards}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <SparklesIcon size={16} color={colors.brandGreen} />
            <Text style={styles.chipText}>Create Flashcards</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {/* Overview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>👁 OVERVIEW</Text>

          <Text style={styles.paragraph}>
            Cellular respiration is a set of metabolic reactions and processes that take place in the cells of organisms to convert biochemical energy from nutrients into adenosine triphosphate (ATP), and then release waste products.
          </Text>

          <Text style={styles.paragraph}>
            The reactions involved in respiration are catabolic reactions, which break large molecules into smaller ones, releasing energy because weak high-energy bonds, in particular molecular oxygen, are replaced by stronger bonds in the products.
          </Text>

          <Text style={styles.sectionSubtitle}>Core Stages of Respiration</Text>

          <View style={styles.stageCard}>
            <Text style={styles.stageTitle}>1. Glycolysis</Text>
            <Text style={styles.stageBody}>
              Occurs in the cytoplasm where one molecule of glucose (6C) is split into two molecules of pyruvate (3C), producing a net yield of 2 ATP and 2 NADH.
            </Text>
          </View>

          <View style={styles.stageCard}>
            <Text style={styles.stageTitle}>2. The Krebs Cycle (Citric Acid Cycle)</Text>
            <Text style={styles.stageBody}>
              Takes place in the mitochondrial matrix. Acetyl-CoA combines with oxaloacetate to produce citric acid, yielding NADH, FADH2, and ATP while releasing CO2.
            </Text>
          </View>

          <View style={styles.stageCard}>
            <Text style={styles.stageTitle}>3. Oxidative Phosphorylation (ETC)</Text>
            <Text style={styles.stageBody}>
              Electrons from NADH and FADH2 pass along the electron transport chain to generate a proton gradient, driving ATP synthase to produce ~30-32 ATP per glucose.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  tagRow: {
    marginBottom: 10,
  },
  tagText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: typography.serifBold,
    fontSize: 36,
    lineHeight: 44,
    color: colors.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  actionChipsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  chipPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  chipText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: 24,
  },
  section: {
    gap: 16,
  },
  sectionOverline: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: typography.serifSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 8,
  },
  paragraph: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  stageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    gap: 6,
  },
  stageTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.brandGreenDark,
  },
  stageBody: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
});
