import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { colors } from './src/theme';
import { ScreenName, TabName, SubjectItem, QuizAttempt } from './src/types';
import { BottomNav } from './src/components/BottomNav';
import { MaterialAPI, SummaryAPI } from './src/api/client';
import QuizOverview from './src/screens/QuizOverview';

// Screenskimi
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { SubjectsScreen } from './src/screens/SubjectsScreen';
import { SubjectDetailScreen } from './src/screens/SubjectDetailScreen';
import { FlashcardsScreen } from './src/screens/FlashcardsScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { QuizScreen } from './src/screens/QuizScreen';
import { QuizSetupScreen, QuizPrefs } from './src/screens/QuizSetupScreen';
import { CardsPrefs } from './src/components/CardsSetupSheet';
import { ProfileScreen } from './src/screens/ProfileScreen';

export default function App() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialAPI | null>(null);
  const [chatPrompt, setChatPrompt] = useState<string | undefined>(undefined);
  const [expandedSummary, setExpandedSummary] = useState<SummaryAPI | null>(null);
  const [chatExplainTerms, setChatExplainTerms] = useState<{ term: string; explanation: string }[] | null>(null);
  const [quizPrefs, setQuizPrefs] = useState<QuizPrefs | null>(null);
  const [flashcardPrefs, setFlashcardPrefs] = useState<CardsPrefs | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentScreen, hasCompletedOnboarding, fadeAnim, translateY]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.splashShell}>
          <View style={styles.splashBadge}>
            <Text style={styles.splashBadgeText}>S</Text>
          </View>
          <ActivityIndicator size="small" color={colors.brandGreen} />
        </View>
      </View>
    );
  }

  // Handle Tab Switch
  const handleSelectTab = (tab: TabName) => {
    setActiveTab(tab);
    setChatPrompt(undefined);
    switch (tab) {
      case 'home':
        setCurrentScreen('home');
        break;
      case 'subjects':
        setCurrentScreen('subjects');
        break;
      case 'chat':
        setCurrentScreen('chat');
        break;
      case 'profile':
        setCurrentScreen('profile');
        break;
    }
  };

  // Screen routing handlers
  const handleOpenPrompt = (promptText: string) => {
    if (promptText.toLowerCase().includes('quiz')) {
      setCurrentScreen('quiz');
    } else if (promptText.toLowerCase().includes('summar')) {
      setCurrentScreen('summary');
    } else {
      setChatExplainTerms(null);
      setChatPrompt(promptText);
      setActiveTab('chat');
      setCurrentScreen('chat');
    }
  };

  const handleOpenSubject = (subject: SubjectItem) => {
    setSelectedSubject(subject);
    setCurrentScreen('subject-detail');
  };

  const handleOpenMaterial = (material: MaterialAPI) => {
    setSelectedMaterial(material);
    setCurrentScreen('summary');
  };

  const subjectIdNum = selectedSubject ? parseInt(selectedSubject.id, 10) : undefined;
  const subjectName = selectedSubject?.name;

  const renderActiveScreen = () => {
    if (!hasCompletedOnboarding) {
      return (
        <OnboardingScreen
          onContinue={() => {
            setHasCompletedOnboarding(true);
            setCurrentScreen('home');
            setActiveTab('home');
          }}
          onSkip={() => {
            setHasCompletedOnboarding(true);
            setCurrentScreen('home');
            setActiveTab('home');
          }}
        />
      );
    }

    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen
            onOpenMenu={() => {
              setActiveTab('subjects');
              setCurrentScreen('subjects');
            }}
            onOpenProfile={() => {
              setActiveTab('profile');
              setCurrentScreen('profile');
            }}
            onSelectPrompt={handleOpenPrompt}
            onOpenContinueSubject={() => {
              if (selectedSubject) setCurrentScreen('subject-detail');
              else {
                setActiveTab('subjects');
                setCurrentScreen('subjects');
              }
            }}
            onSelectSubject={handleOpenSubject}
            onOpenQuizResult={(attempt) => {
              if (attempt.subjectId !== null) {
                setSelectedSubject({
                  id: String(attempt.subjectId),
                  name: attempt.subjectName,
                  materialsCount: 0,
                  mastery: 0,
                });
              }
              setSelectedAttempt(attempt);
              setActiveTab('home');
              setCurrentScreen('quiz-result');
            }}
          />
        );

      case 'chat':
        return (
          <ChatScreen
            onOpenMenu={() => {
              setActiveTab('subjects');
              setCurrentScreen('subjects');
            }}
            onOpenProfile={() => {
              setActiveTab('profile');
              setCurrentScreen('profile');
            }}
            initialPrompt={chatPrompt}
            subjectId={subjectIdNum}
            subjectName={subjectName}
            initialSummary={expandedSummary ?? undefined}
            explainTerms={chatExplainTerms}
            onSummaryConsumed={() => setExpandedSummary(null)}
          />
        );

      case 'subjects':
        return (
          <SubjectsScreen
            onOpenMenu={() => {}}
            onOpenProfile={() => {
              setActiveTab('profile');
              setCurrentScreen('profile');
            }}
            onSelectSubject={handleOpenSubject}
          />
        );

      case 'subject-detail':
        return selectedSubject ? (
          <SubjectDetailScreen
            subject={selectedSubject}
            onBack={() => {
              setActiveTab('subjects');
              setCurrentScreen('subjects');
            }}
            onProfile={() => {
              setActiveTab('profile');
              setCurrentScreen('profile');
            }}
            onAskAI={() => {
              setChatExplainTerms(null);
              setActiveTab('chat');
              setCurrentScreen('chat');
            }}
            onExplain={(summary) => {
              setChatExplainTerms(summary?.key_terms ?? null);
              setActiveTab('chat');
              setCurrentScreen('chat');
            }}
            onStartQuiz={() => setCurrentScreen('quiz-setup')}
            onStartCards={(prefs) => {
              setFlashcardPrefs(prefs);
              setCurrentScreen('flashcards');
            }}
            onOpenMaterial={handleOpenMaterial}
            onExpandSummary={(summary) => {
              setChatExplainTerms(null);
              setExpandedSummary(summary);
              setActiveTab('chat');
              setCurrentScreen('chat');
            }}
          />
        ) : (
          <SubjectsScreen
            onOpenMenu={() => {}}
            onOpenProfile={() => {
              setActiveTab('profile');
              setCurrentScreen('profile');
            }}
            onSelectSubject={handleOpenSubject}
          />
        );

      case 'summary':
        return (
          <SummaryScreen
            onOpenMenu={() => {
              setActiveTab('subjects');
              setCurrentScreen('subjects');
            }}
            onOpenProfile={() => {
              setActiveTab('profile');
              setCurrentScreen('profile');
            }}
            onCreateQuiz={() => { setQuizPrefs(null); setCurrentScreen('quiz'); }}
            onCreateFlashcards={() => { setFlashcardPrefs(null); setCurrentScreen('flashcards'); }}
            subjectId={subjectIdNum}
            subjectName={subjectName}
            chapterTitle={selectedMaterial?.filename}
          />
        );

      case 'flashcards':
        return (
          <FlashcardsScreen
            onOpenMenu={() => {
              setActiveTab('subjects');
              setCurrentScreen('subjects');
            }}
            onOpenProfile={() => {
              setActiveTab('profile');
              setCurrentScreen('profile');
            }}
            subjectId={subjectIdNum}
            subjectName={subjectName}
            deckTitle={selectedMaterial ? `${selectedMaterial.filename} Deck` : undefined}
            {...(flashcardPrefs
              ? { cardCount: flashcardPrefs.cardCount, focus: flashcardPrefs.focus, sourceMaterialId: flashcardPrefs.source }
              : {})}
          />
        );

      case 'quiz':
        return (
          <QuizScreen
            onClose={() => setCurrentScreen(selectedSubject ? 'subject-detail' : 'home')}
            onPause={() => setCurrentScreen('home')}
            onRetake={() => setCurrentScreen('quiz-setup')}
            subjectId={subjectIdNum}
            subjectName={subjectName}
            topicTag={selectedMaterial?.filename}
            {...(quizPrefs
              ? { questionCount: quizPrefs.questionCount, difficulty: quizPrefs.difficulty, sourceMaterialId: quizPrefs.source, timeLimit: quizPrefs.timeLimit }
              : {})}
          />
        );

      case 'quiz-result':
        if (selectedAttempt) {
          return (
            <QuizOverview
              questions={selectedAttempt.questions}
              answers={selectedAttempt.answers}
              subjectName={selectedAttempt.subjectName}
              onClose={() => {
                setSelectedAttempt(null);
                setActiveTab('home');
                setCurrentScreen('home');
              }}
              onRetake={() => {
                setSelectedAttempt(null);
                setCurrentScreen('quiz-setup');
              }}
            />
          );
        }
        return null;

      case 'quiz-setup':
        return (
          <QuizSetupScreen
            subjectId={subjectIdNum}
            subjectName={subjectName}
            onClose={() => setCurrentScreen('subject-detail')}
            onStart={(prefs) => {
              setQuizPrefs(prefs);
              setCurrentScreen('quiz');
            }}
          />
        );

      case 'profile':
        return (
          <ProfileScreen
            onOpenMenu={() => {
              setActiveTab('subjects');
              setCurrentScreen('subjects');
            }}
            onOpenAISettings={() => {}}
          />
        );

      case 'onboarding':
        return (
          <OnboardingScreen
            onContinue={() => {
              setHasCompletedOnboarding(true);
              setCurrentScreen('home');
              setActiveTab('home');
            }}
            onSkip={() => {
              setHasCompletedOnboarding(true);
              setCurrentScreen('home');
              setActiveTab('home');
            }}
          />
        );

      default:
        return null;
    }
  };

  const showBottomNav =
    hasCompletedOnboarding &&
    currentScreen !== 'quiz' &&
    currentScreen !== 'quiz-result' &&
    currentScreen !== 'onboarding';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <Animated.View
          style={[
            styles.screenContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          {renderActiveScreen()}
        </Animated.View>
        {showBottomNav && (
          <BottomNav currentTab={activeTab} onSelectTab={handleSelectTab} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashShell: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    gap: 10,
  },
  splashBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  splashBadgeText: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: colors.brandGreen,
  },
});
