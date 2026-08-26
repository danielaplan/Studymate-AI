import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { ClockIcon } from '../components/Icons';
import { QuizOptionItem } from '../components/QuizOptionItem';
import { QuizQuestion } from '../types';
import { generateQuiz, getQuizQuestions, QuizQuestionAPI } from '../api/client';

interface QuizScreenProps {
  onClose: () => void;
  onPause?: () => void;
  subjectId?: number;
  subjectName?: string;
  topicTag?: string;
}

const FALLBACK_QUESTIONS: QuizQuestion[] = [
  {
    id: '1',
    topic: 'NETWORKING FUNDAMENTALS',
    questionNumber: 1,
    totalQuestions: 2,
    questionText: 'What is the primary function of a network router?',
    options: [
      'To connect devices within a LAN and forward data based on MAC addresses.',
      'To forward packets between networks based on destination IP addresses.',
      'To modulate digital signals into analog for transmission.',
      'To assign domain names to hardware MAC addresses.',
    ],
    correctIndex: 1,
  },
  {
    id: '2',
    topic: 'NETWORKING FUNDAMENTALS',
    questionNumber: 2,
    totalQuestions: 2,
    questionText: 'Which OSI layer is responsible for reliable end-to-end communication?',
    options: ['Data Link Layer (2)', 'Network Layer (3)', 'Transport Layer (4)', 'Session Layer (5)'],
    correctIndex: 2,
  },
];

function apiToQuizQuestion(api: QuizQuestionAPI, idx: number, total: number): QuizQuestion {
  return {
    id: String(api.id ?? idx),
    topic: api.topic || 'STUDY QUESTION',
    questionNumber: idx + 1,
    totalQuestions: total,
    questionText: api.question,
    options: api.options,
    correctIndex: api.correct_index,
    explanation: api.explanation,
  };
}

export function QuizScreen({ onClose, onPause, subjectId, subjectName, topicTag }: QuizScreenProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!subjectId) return;
    loadOrGenerateQuiz();
  }, [subjectId]);

  const loadOrGenerateQuiz = async () => {
    if (!subjectId) return;
    setIsLoading(true);
    try {
      let apiQs = await getQuizQuestions(subjectId);
      if (!apiQs.length) {
        const result = await generateQuiz(subjectId, topicTag, 10);
        apiQs = result.questions;
      }
      setQuestions(apiQs.map((q, i) => apiToQuizQuestion(q, i, apiQs.length)));
      setCurrentIdx(0);
      setScore(0);
      setIsCompleted(false);
    } catch {
      setQuestions(FALLBACK_QUESTIONS);
    } finally {
      setIsLoading(false);
    }
  };

  const question = questions[currentIdx] || questions[0];
  const progressPercent = ((currentIdx + 1) / question.totalQuestions) * 100;

  const handleNext = () => {
    if (selectedOption === null) {
      Alert.alert('Select an answer', 'Please choose an option before continuing.');
      return;
    }
    if (selectedOption === question.correctIndex) setScore((s) => s + 1);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((p) => p + 1);
      setSelectedOption(null);
    } else {
      setIsCompleted(true);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header showClose onClose={onClose} rightActionText="Pause" onRightAction={onPause} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.brandGreen} />
          <Text style={styles.loadingText}>Generating quiz from your study materials...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header showClose onClose={onClose} rightActionText="Pause" onRightAction={onPause} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Counter & Timer */}
        <View style={styles.counterRow}>
          <Text style={styles.counterText}>QUESTION {question.questionNumber} OF {question.totalQuestions}</Text>
          <View style={styles.timerGroup}>
            <ClockIcon size={14} color={colors.textMuted} />
            <Text style={styles.timerText}>14:59</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        <Text style={styles.topicTag}>{question.topic}</Text>
        <Text style={styles.questionText}>{question.questionText}</Text>

        <View style={styles.optionsList}>
          {question.options.map((opt, idx) => (
            <QuizOptionItem
              key={idx}
              text={opt}
              selected={selectedOption === idx}
              onSelect={() => setSelectedOption(idx)}
            />
          ))}
        </View>

        <Pressable
          accessibilityLabel="Submit answer"
          onPress={handleNext}
          style={({ pressed }) => [styles.submitButton, pressed && styles.submitButtonPressed]}
        >
          <Text style={styles.submitButtonText}>
            {currentIdx === questions.length - 1 ? 'Finish Quiz' : 'Next Question →'}
          </Text>
        </Pressable>

        {isCompleted && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Quiz Completed! 🎉</Text>
            <Text style={styles.resultSubtitle}>
              You scored {score} out of {questions.length} questions correctly.
              {score >= questions.length * 0.8 ? ' Excellent work!' : ' Keep reviewing and try again!'}
            </Text>
            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Return to Study</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  counterText: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5 },
  timerGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { fontFamily: typography.sansMedium, fontSize: 13, color: colors.textMuted },
  progressTrack: { height: 3, backgroundColor: '#E6E9E2', borderRadius: 1.5, overflow: 'hidden', marginBottom: 28 },
  progressFill: { height: 3, backgroundColor: colors.brandGreen },
  topicTag: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  questionText: { fontFamily: typography.serifBold, fontSize: 28, lineHeight: 38, color: colors.textPrimary, marginBottom: 32 },
  optionsList: { marginBottom: 24 },
  submitButton: { height: 52, borderRadius: 26, backgroundColor: '#1E221D', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  submitButtonPressed: { opacity: 0.85 },
  submitButtonText: { fontFamily: typography.sansSemiBold, fontSize: 15, color: '#FFFFFF' },
  resultCard: { marginTop: 20, padding: 24, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', gap: 12 },
  resultTitle: { fontFamily: typography.serifBold, fontSize: 22, color: colors.brandGreenDark },
  resultSubtitle: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  doneBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: colors.brandGreen, borderRadius: 20 },
  doneBtnText: { fontFamily: typography.sansMedium, fontSize: 14, color: '#FFFFFF' },
});
