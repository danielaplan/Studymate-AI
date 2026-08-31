import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { AnalyticsIcon } from '../components/Icons';
import { QuizQuestion, QuizAnswer } from '../types';

export type { QuizAnswer } from '../types';

interface QuizOverviewProps {
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  subjectName?: string;
  onClose: () => void;
  onRetake: () => void;
}

const CORRECT = colors.brandGreen;
const INCORRECT = colors.error;
const AMBER = colors.warning;

function bandColor(pct: number): string {
  if (pct >= 80) return CORRECT;
  if (pct >= 50) return AMBER;
  return INCORRECT;
}

function analysisText(pct: number): string {
  if (pct >= 80) return 'Strong grasp! You answered most questions correctly — keep this material fresh with spaced review.';
  if (pct >= 50) return 'Good progress. Review the questions you missed below, then try the quiz once more to lock it in.';
  return 'Keep studying. Revisit the source notes for the topics below, then retake the quiz to build confidence.';
}

function QuizOverview({ questions, answers, subjectName, onClose, onRetake }: QuizOverviewProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const total = questions.length;
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const incorrectCount = total - correctCount;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const ringColor = bandColor(pct);

  // Per-topic breakdown for the analysis bar chart.
  const byTopic = new Map<string, { correct: number; total: number }>();
  questions.forEach((q, i) => {
    const entry = byTopic.get(q.topic) || { correct: 0, total: 0 };
    entry.total += 1;
    if (answers[i]?.isCorrect) entry.correct += 1;
    byTopic.set(q.topic, entry);
  });
  const topicRows = Array.from(byTopic.entries());

  return (
    <View style={styles.container}>
      <Header showClose onClose={onClose} />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        data={questions}
        keyExtractor={(q) => q.id}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Quiz Results</Text>
            {subjectName ? <Text style={styles.subtitle}>{subjectName}</Text> : null}

            {/* Score ring + proportion bar */}
            <View style={styles.scoreCard}>
              <View style={[styles.ring, { borderColor: ringColor }]}>
                <Text style={[styles.ringPct, { color: ringColor }]}>{pct}%</Text>
                <Text style={styles.ringLabel}>{correctCount}/{total} correct</Text>
              </View>
              <View style={styles.ringSide}>
                <Text style={styles.scoreHeadline}>
                  You scored {correctCount} of {total}
                </Text>
                <View style={styles.propBar}>
                  <View style={[styles.propFill, { width: `${pct}%`, backgroundColor: CORRECT }]} />
                  <View style={[styles.propFillMiss, { width: `${100 - pct}%`, backgroundColor: INCORRECT }]} />
                </View>
                <View style={styles.propLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: CORRECT }]} />
                    <Text style={styles.legendText}>{correctCount} correct</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: INCORRECT }]} />
                    <Text style={styles.legendText}>{incorrectCount} incorrect</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Analysis */}
            <View style={styles.analysisCard}>
              <View style={styles.analysisHeader}>
                <View style={styles.analysisIconWrap}>
                  <AnalyticsIcon size={16} color={colors.brandGreenDark} />
                </View>
                <Text style={styles.analysisLabel}>ANALYSIS</Text>
              </View>
              <Text style={styles.analysisText}>{analysisText(pct)}</Text>
            </View>

            {/* Per-topic bars */}
            {topicRows.length > 1 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Performance by topic</Text>
                <View style={styles.topicList}>
                  {topicRows.map(([topic, { correct, total: t }]) => {
                    const tp = t > 0 ? Math.round((correct / t) * 100) : 0;
                    return (
                      <View key={topic} style={styles.topicRow}>
                        <View style={styles.topicHead}>
                          <Text style={styles.topicName} numberOfLines={2}>{topic}</Text>
                          <Text style={styles.topicPct}>{correct}/{t}</Text>
                        </View>
                        <View style={styles.topicBarTrack}>
                          <View style={[styles.topicBarFill, { width: `${tp}%`, backgroundColor: bandColor(tp) }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Review answers header */}
            <Text style={styles.blockTitle}>Review answers</Text>
          </>
        }
        renderItem={({ item: q, index: i }) => {
          const ans = answers[i];
          const isOpen = expanded === i;
          return (
            <View style={styles.reviewCard}>
              <Pressable
                accessibilityLabel={`Review question ${i + 1}`}
                onPress={() => setExpanded(isOpen ? null : i)}
                style={({ pressed }) => [styles.reviewHead, pressed && styles.rowPressed]}
              >
                <View style={[styles.reviewBadge, ans?.isCorrect ? styles.badgeOk : styles.badgeBad]}>
                  <Text style={styles.reviewBadgeText}>{ans?.isCorrect ? '✓' : '✕'}</Text>
                </View>
                <Text style={styles.reviewQuestion} numberOfLines={isOpen ? undefined : 2}>
                  {i + 1}. {q.questionText}
                </Text>
                <Text style={styles.reviewToggle}>{isOpen ? 'Hide' : 'Why?'}</Text>
              </Pressable>

              <View style={styles.optionsStack}>
                {q.options.map((opt, idx) => {
                  const isCorrectOpt = idx === q.correctIndex;
                  const isUserOpt = ans?.selected === idx;
                  const wrongPick = isUserOpt && !isCorrectOpt;
                  const optStyle = isCorrectOpt
                    ? styles.optCorrect
                    : wrongPick
                    ? styles.optWrong
                    : styles.optNeutral;
                  return (
                    <View key={idx} style={[styles.optRow, optStyle]}>
                      <Text style={styles.optMarker}>
                        {isCorrectOpt ? '✓' : wrongPick ? '✕' : ''}
                      </Text>
                      <Text style={[styles.optText, isCorrectOpt && styles.optTextCorrect, wrongPick && styles.optTextWrong]}>
                        {opt}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {isOpen && (
                <View style={styles.whyBox}>
                  <Text style={styles.whyLabel}>WHY — BASED ON YOUR SOURCES</Text>
                  <Text style={styles.whyText}>
                    {q.explanation || 'No source explanation was stored for this question.'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.actionRow}>
            <Pressable
              accessibilityLabel="Retake quiz"
              onPress={onRetake}
              style={({ pressed }) => [styles.retakeBtn, pressed && styles.retakePressed]}
            >
              <Text style={styles.retakeBtnText}>Retake Quiz</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Return to study"
              onPress={onClose}
              style={({ pressed }) => [styles.doneBtn, pressed && styles.donePressed]}
            >
              <Text style={styles.doneBtnText}>Return to Study</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  title: { fontFamily: typography.serifBold, fontSize: 30, color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.textMuted, marginBottom: 20 },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  ring: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  ringPct: { fontFamily: typography.serifBold, fontSize: 26, lineHeight: 30, textAlign: 'center' },
  ringLabel: { fontFamily: typography.sansMedium, fontSize: 11, color: colors.textMuted, marginTop: 3, textAlign: 'center' },
  ringSide: { flex: 1 },
  scoreHeadline: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.textPrimary, marginBottom: 10 },
  propBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.borderLight },
  propFill: { height: 10 },
  propFillMiss: { height: 10 },
  propLegend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.textMuted },
  analysisCard: {
    backgroundColor: colors.sageBadge,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.brandGreenLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandGreen,
    marginBottom: 16,
  },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  analysisIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisLabel: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.brandGreenDark, letterSpacing: 1.5 },
  analysisText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  block: { marginBottom: 18 },
  blockTitle: { fontFamily: typography.sansSemiBold, fontSize: 13, color: colors.textMuted, letterSpacing: 1.2, marginBottom: 12 },
  topicList: { gap: 14 },
  topicRow: { marginBottom: 2 },
  topicHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  topicName: { flex: 1, fontFamily: typography.sansMedium, fontSize: 12, color: colors.textPrimary },
  topicBarTrack: { height: 12, borderRadius: 6, backgroundColor: colors.borderLight, overflow: 'hidden' },
  topicBarFill: { height: 12, borderRadius: 6 },
  topicPct: { fontFamily: typography.sansMedium, fontSize: 12, color: colors.textMuted },
  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reviewBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  badgeOk: { backgroundColor: colors.brandGreenSoft },
  badgeBad: { backgroundColor: colors.errorSoft },
  reviewBadgeText: { fontFamily: typography.sansBold, fontSize: 14, color: colors.textPrimary },
  reviewQuestion: {
    flex: 1,
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  reviewToggle: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.brandGreen, marginTop: 4 },
  optionsStack: { gap: 8, marginTop: 12 },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  optNeutral: { backgroundColor: colors.surface, borderColor: colors.borderLight },
  optCorrect: { backgroundColor: colors.brandGreenSoft, borderColor: colors.brandGreen },
  optWrong: { backgroundColor: colors.errorSoft, borderColor: INCORRECT },
  optMarker: { width: 16, fontFamily: typography.sansBold, fontSize: 14, color: colors.textPrimary, textAlign: 'center' },
  optText: { flex: 1, fontFamily: typography.sansRegular, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  optTextCorrect: { fontFamily: typography.sansMedium, color: colors.textPrimary },
  optTextWrong: { fontFamily: typography.sansMedium, color: colors.errorText },
  whyBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: colors.sageBadge,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brandGreenLight,
  },
  whyLabel: { fontFamily: typography.sansSemiBold, fontSize: 10, color: colors.brandGreenDark, letterSpacing: 1, marginBottom: 6 },
  whyText: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  rowPressed: { opacity: 0.7 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  retakeBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakePressed: { opacity: 0.8 },
  retakeBtnText: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.brandGreen },
  doneBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donePressed: { opacity: 0.88 },
  doneBtnText: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.background },
});

export default QuizOverview;
