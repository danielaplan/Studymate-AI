import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { ClockIcon } from '../components/Icons';
import { QuizOptionItem } from '../components/QuizOptionItem';
import { QuizQuestion, QuizAnswer, QuizAttempt } from '../types';
import { generateQuiz, getQuizQuestions, recordQuizAttempt, QuizQuestionAPI } from '../api/client';
import QuizOverview from './QuizOverview';
import { saveQuizAttempt } from '../storage/quizHistory';
import { addMemoryEntry } from '../storage/subjectMemory';

interface QuizScreenProps {
  onClose: () => void;
  onPause?: () => void;
  onRetake?: () => void;
  subjectId?: number;
  subjectName?: string;
  topicTag?: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  sourceMaterialId?: number | 'all';
  timeLimit?: number | null;
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

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function QuizScreen({
  onClose,
  onPause,
  onRetake,
  subjectId,
  subjectName,
  topicTag,
  questionCount,
  difficulty,
  sourceMaterialId,
  timeLimit,
}: QuizScreenProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Keep the latest questions available to the timer closure so it can mark
  // unanswered questions correctly when time runs out.
  const questionsRef = React.useRef(questions);
  questionsRef.current = questions;

  // A custom config (specific source / count / difficulty) means we always
  // generate fresh questions instead of reusing stored ones.
  const customConfig =
    sourceMaterialId !== undefined && sourceMaterialId !== 'all' ||
    questionCount !== undefined ||
    difficulty !== undefined;

  useEffect(() => {
    if (!subjectId) return;
    loadOrGenerateQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const loadOrGenerateQuiz = async () => {
    if (!subjectId) return;
    setIsLoading(true);
    try {
      let apiQs: QuizQuestionAPI[];
      if (customConfig) {
        const result = await generateQuiz(subjectId, {
          topicTag,
          numQuestions: questionCount ?? 10,
          materialId: sourceMaterialId,
          difficulty,
        });
        apiQs = result.questions;
      } else {
        apiQs = await getQuizQuestions(subjectId);
        if (!apiQs.length) {
          const result = await generateQuiz(subjectId, { topicTag, numQuestions: 10 });
          apiQs = result.questions;
        }
      }
      setQuestions(apiQs.map((q, i) => apiToQuizQuestion(q, i, apiQs.length)));
      setCurrentIdx(0);
      setAnswers([]);
      setIsCompleted(false);
    } catch {
      setQuestions(FALLBACK_QUESTIONS);
    } finally {
      setIsLoading(false);
    }
  };

  // Live countdown when a time limit is set. On expiry the quiz ends and the
  // full results overview is shown (unanswered questions counted as incorrect).
  useEffect(() => {
    if (!timeLimit) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(timeLimit * 60);
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          clearInterval(id);
          // Mark any unanswered questions as incorrect so the overview is complete.
          setAnswers((prev) => {
            const next = [...prev];
            for (let i = prev.length; i < questionsRef.current.length; i++) {
              next.push({ selected: null, correct: questionsRef.current[i].correctIndex, isCorrect: false });
            }
            return next;
          });
          setIsCompleted(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeLimit]);

  // Persist a history entry as soon as the quiz is completed. The `answers`
  // array is already final at this point (filled on submit and on time-out).
  useEffect(() => {
    if (!isCompleted || questions.length === 0) return;
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const attempt: QuizAttempt = {
      id: `qa_${Date.now()}`,
      subjectId: subjectId ?? null,
      subjectName: subjectName ?? 'Quiz',
      score: correctCount,
      total: questions.length,
      pct: Math.round((correctCount / questions.length) * 100),
      difficulty: difficulty ?? null,
      count: questions.length,
      createdAt: new Date().toISOString(),
      questions,
      answers,
    };
    saveQuizAttempt(attempt).catch(() => {
      // Storage unavailable — ignore so the results screen still renders.
    });
    if (subjectId != null) {
      addMemoryEntry({
        type: 'quiz',
        subjectId,
        timestamp: new Date().toISOString(),
        attemptId: attempt.id,
        score: attempt.score,
        total: attempt.total,
        pct: attempt.pct,
      }).catch(() => {});

      // Record real quiz performance so mastery can be computed per topic.
      const attempts = questions.map((q, i) => ({
        topic: q.topic,
        correct: answers[i]?.isCorrect ?? false,
      }));
      recordQuizAttempt(subjectId, attempts).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted]);

  const question = questions[currentIdx] || questions[0];
  const progressPercent = ((currentIdx + 1) / question.totalQuestions) * 100;

  const handleNext = () => {
    if (selectedOption === null) {
      Alert.alert('Select an answer', 'Please choose an option before continuing.');
      return;
    }
    const isCorrect = selectedOption === question.correctIndex;
    setAnswers((prev) => [
      ...prev,
      { selected: selectedOption, correct: question.correctIndex, isCorrect },
    ]);

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

  if (isCompleted) {
    return (
      <QuizOverview
        questions={questions}
        answers={answers}
        subjectName={subjectName}
        onClose={onClose}
        onRetake={onRetake ?? (() => {})}
      />
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
            <ClockIcon size={14} color={timeLimit ? colors.brandGreen : colors.textMuted} />
            <Text style={[styles.timerText, timeLimit ? styles.timerTextActive : undefined]}>
              {secondsLeft !== null ? formatTime(secondsLeft) : 'No limit'}
            </Text>
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
              onSelect={() => {
                if (!isCompleted) setSelectedOption(idx);
              }}
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
  timerTextActive: { fontFamily: typography.sansSemiBold, fontSize: 13, color: colors.brandGreen },
  progressTrack: { height: 3, backgroundColor: '#E6E9E2', borderRadius: 1.5, overflow: 'hidden', marginBottom: 28 },
  progressFill: { height: 3, backgroundColor: colors.brandGreen },
  topicTag: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  questionText: { fontFamily: typography.serifBold, fontSize: 28, lineHeight: 38, color: colors.textPrimary, marginBottom: 32 },
  optionsList: { marginBottom: 24 },
  submitButton: { height: 52, borderRadius: 26, backgroundColor: '#1E221D', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  submitButtonPressed: { opacity: 0.85 },
  submitButtonText: { fontFamily: typography.sansSemiBold, fontSize: 15, color: '#FFFFFF' },
});
