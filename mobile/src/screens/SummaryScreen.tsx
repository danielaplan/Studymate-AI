import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { DocumentIcon, SparklesIcon } from '../components/Icons';
import { generateSummary, SummaryAPI } from '../api/client';
import { addMemoryEntry } from '../storage/subjectMemory';

interface SummaryScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onCreateQuiz: () => void;
  onCreateFlashcards: () => void;
  subjectId?: number;
  subjectName?: string;
  chapterTitle?: string;
}

export function SummaryScreen({
  onOpenMenu,
  onOpenProfile,
  onCreateQuiz,
  onCreateFlashcards,
  subjectId,
  subjectName,
  chapterTitle,
}: SummaryScreenProps) {
  const [summaryData, setSummaryData] = useState<SummaryAPI | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (subjectId) {
      loadSummary();
    }
  }, [subjectId, chapterTitle]);

  const loadSummary = async () => {
    if (!subjectId) return;
    setIsLoading(true);
    try {
      const data = await generateSummary(subjectId, undefined, chapterTitle);
      setSummaryData(data);
      if (subjectId) {
        addMemoryEntry({
          type: 'summary',
          subjectId,
          title: data.title || chapterTitle || subjectName || 'Summary',
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch {
      // Fallback
      setSummaryData({
        title: chapterTitle || (subjectName ? `${subjectName} Overview` : 'Course Summary'),
        subtitle: 'Key concepts and principles extracted from your uploaded study materials.',
        overview_paragraphs: [
          'No materials have been uploaded for this subject yet. Upload lecture notes or PDFs in the Subject Details tab to generate an automated chapter summary.',
        ],
        key_terms: [],
        takeaways: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const title = summaryData?.title || chapterTitle || (subjectName ? `${subjectName} Summary` : 'Study Summary');
  const subtitle = summaryData?.subtitle || 'Grounded summary extracted directly from your course materials.';
  const paragraphs = summaryData?.overview_paragraphs || [
    'Upload lecture notes or textbook chapters in the Subject Details tab to automatically generate a structured study summary.',
  ];

  return (
    <View style={styles.container}>
      <Header onMenu={onOpenMenu} onProfile={onOpenProfile} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Subject Tag */}
        <View style={styles.tagRow}>
          <Text style={styles.tagText}>
            📖 {subjectName ? subjectName.toUpperCase() : 'COURSE MATERIALS'}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{subtitle}</Text>

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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionOverline}>👁 OVERVIEW</Text>
            {isLoading && <ActivityIndicator size="small" color={colors.brandGreen} />}
          </View>

          {paragraphs.map((p, idx) => (
            <Text key={idx} style={styles.paragraph}>{p}</Text>
          ))}

          {summaryData?.key_terms && summaryData.key_terms.length > 0 && (
            <>
              <Text style={styles.sectionSubtitle}>Key Terms &amp; Definitions</Text>
              {summaryData.key_terms.map((item, idx) => (
                <View key={idx} style={styles.stageCard}>
                  <Text style={styles.stageTitle}>{item.term}</Text>
                  <Text style={styles.stageBody}>{item.explanation}</Text>
                </View>
              ))}
            </>
          )}

          {summaryData?.takeaways && summaryData.takeaways.length > 0 && (
            <>
              <Text style={styles.sectionSubtitle}>Key Takeaways</Text>
              {summaryData.takeaways.map((t, idx) => (
                <View key={idx} style={styles.takeawayRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.takeawayText}>{t}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },
  tagRow: { marginBottom: 10 },
  tagText: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5 },
  title: { fontFamily: typography.serifBold, fontSize: 36, lineHeight: 44, color: colors.textPrimary, marginBottom: 16, letterSpacing: -0.5 },
  subtitle: { fontFamily: typography.sansRegular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, marginBottom: 24 },
  actionChipsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.borderMedium, backgroundColor: '#FFFFFF', gap: 8 },
  chipPressed: { backgroundColor: colors.surfaceMuted },
  chipText: { fontFamily: typography.sansMedium, fontSize: 13, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.borderLight, marginBottom: 24 },
  section: { gap: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionOverline: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5 },
  sectionSubtitle: { fontFamily: typography.serifSemiBold, fontSize: 18, color: colors.textPrimary, marginTop: 12 },
  paragraph: { fontFamily: typography.sansRegular, fontSize: 15, lineHeight: 24, color: colors.textPrimary },
  stageCard: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: colors.borderLight, padding: 16, gap: 6 },
  stageTitle: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.brandGreenDark },
  stageBody: { fontFamily: typography.sansRegular, fontSize: 14, lineHeight: 22, color: colors.textSecondary },
  takeawayRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bulletDot: { fontFamily: typography.sansBold, fontSize: 16, color: colors.brandGreen },
  takeawayText: { flex: 1, fontFamily: typography.sansRegular, fontSize: 14, lineHeight: 22, color: colors.textPrimary },
});
