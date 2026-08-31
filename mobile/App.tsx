import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, ActivityIndicator, Text, Alert, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular_Italic,
} from '@expo/google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo/google-fonts/inter';

import { colors } from './src/theme';
import { ScreenName, TabName, SubjectItem, QuizAttempt, GuidedCapture } from './src/types';
import { BottomNav } from './src/components/BottomNav';
import { EdgeBack } from './src/components/EdgeBack';
import { ContentContainer } from './src/components/ContentContainer';
import { MaterialAPI, updateSubject, deleteSubject } from './src/api/client';
import { resolveRouting } from './src/utils/intent';
import QuizOverview from './src/screens/QuizOverview';
import { hasCompletedOnboarding, setOnboardingComplete } from './src/storage/onboarding';
import { clearChatThread } from './src/storage/chatThread';

// Screenskimi
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SubjectsScreen } from './src/screens/SubjectsScreen';
import { SubjectWorkspaceScreen } from './src/screens/SubjectWorkspaceScreen';
import { FlashcardsScreen } from './src/screens/FlashcardsScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { QuizScreen } from './src/screens/QuizScreen';
import { QuizSetupScreen, QuizPrefs } from './src/screens/QuizSetupScreen';
import { CardsPrefs } from './src/components/CardsSetupSheet';
import { ProfileScreen } from './src/screens/ProfileScreen';

// Accessibility: cap Dynamic Type scaling app-wide so large accessibility text
// sizes don't overflow fixed-height rows or clip (no maxFontSizeMultiplier was
// set anywhere in src/). iOS HIG + Android font-scale guidance. 1.3 keeps the
// system's largest setting usable without breaking the quiet-tutor layouts.
// Accessibility: cap Dynamic Type scaling app-wide so large accessibility text
// sizes don't overflow fixed-height rows or clip (no maxFontSizeMultiplier was
// set anywhere in src/). iOS HIG + Android font-scale guidance. 1.3 keeps the
// system's largest setting usable without breaking the quiet-tutor layouts.
// `defaultProps` was removed from the RN Text typings, so cast for the side effect.
(Text as any).defaultProps = {
  ...((Text as any).defaultProps || {}),
  maxFontSizeMultiplier: 1.3,
};

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

  // Onboarding completion is persisted (AsyncStorage) so it plays once, not on
  // every cold start. `onboardingChecked` gates rendering until the stored flag
  // is read, so a returning user never sees an onboarding flash.
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialAPI | null>(null);
  // Where subject-detail should return to on Back. Subject-detail is reachable
  // from Home (Continue card / Recent Subjects) and from the Subjects tab; Back
  // should return to where the user actually came from, not always Subjects.
  const [subjectReturnTo, setSubjectReturnTo] = useState<'home' | 'subjects'>('subjects');
  const [chatPrompt, setChatPrompt] = useState<string | undefined>(undefined);
  const [quizPrefs, setQuizPrefs] = useState<QuizPrefs | null>(null);
  // Quiz origin (audit A3): remembers which screen the quiz was launched from
  // so Close/Retake return there instead of always dumping the user in
  // subject-detail. 'quiz-setup' (dedicated flow) keeps its existing behavior.
  const [quizOrigin, setQuizOrigin] = useState<ScreenName>('subject-detail');
  // Workspace "Switch subject" picker is a DISMISSIBLE OVERLAY (NotebookLM-style
  // library), not a route swap — so the workspace stays mounted beneath and
  // closing it returns you exactly where you were (no dead-end route).
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  // Workspace chat sheet (FAB → full-height slide-up). Owned here (not in the
  // screen) so the global back handlers close the sheet *instead of* navigating
  // out of the workspace.
  const [chatOpen, setChatOpen] = useState(false);
  // True only when the CURRENT flashcards/quiz launch came from a specific
  // material's Summary screen — gates the deckTitle/topicTag so a stale
  // selectedMaterial from an earlier screen never scopes later quizzes.
  const [flashcardFromSummary, setFlashcardFromSummary] = useState(false);
  const [flashcardPrefs, setFlashcardPrefs] = useState<CardsPrefs | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);
  // Guided create-subject thread (Slice 4 remainder): durable capture state is
  // lifted HERE (guard M1) so the in-progress name/scope/output answers survive
  // HomeScreen unmounting when the user navigates away mid-flow.
  const [guidedCapture, setGuidedCapture] = useState<GuidedCapture | null>(null);

  // Back destinations for pushed screens (universal back). Each pushed screen
  // remembers the screen it should return to, so the local back row, the iOS/web
  // edge swipe, and the Android hardware back all climb one level up together.
  const [chatReturnTo, setChatReturnTo] = useState<ScreenName | null>(null);
  const [summaryReturnTo, setSummaryReturnTo] = useState<ScreenName | null>(null);
  const [flashcardsReturnTo, setFlashcardsReturnTo] = useState<ScreenName | null>(null);

  // Clear the three pushed-screen return markers so a stale one can't leak into
  // the next navigation (leaving chat for a tab, or switching screen kind).
  const clearReturnTos = () => {
    setChatReturnTo(null);
    setSummaryReturnTo(null);
    setFlashcardsReturnTo(null);
  };

  // Which bottom tab to highlight when returning to a given screen.
  const activeTabFor = (target: ScreenName): TabName => {
    if (target === 'home' || target === 'subjects' || target === 'profile') {
      return target;
    }
    // subject-detail / summary / flashcards are children of the tab that owns
    // subject-detail (home or subjects).
    return subjectReturnTo;
  };

  // The single "go back one level" action, shared by the chevron, the edge
  // swipe, and the hardware back button.
  const performBack = () => {
    switch (currentScreen) {
      case 'summary':
        if (summaryReturnTo) {
          setActiveTab(activeTabFor(summaryReturnTo));
          setCurrentScreen(summaryReturnTo);
        }
        break;
      case 'flashcards':
        if (flashcardsReturnTo) {
          setActiveTab(activeTabFor(flashcardsReturnTo));
          setCurrentScreen(flashcardsReturnTo);
        }
        break;
      case 'subject-detail':
        setActiveTab(subjectReturnTo);
        setCurrentScreen(subjectReturnTo);
        setSelectedMaterial(null);
        break;
      case 'quiz':
      case 'quiz-setup':
      case 'quiz-result':
        // Quiz screens keep their explicit Close; hardware/back routes there.
        // Returning to subject-detail highlights the tab that owns it.
        setActiveTab(quizOrigin === 'chat' ? 'chat' : selectedSubject ? subjectReturnTo : 'home');
        setCurrentScreen(quizOrigin === 'chat' ? 'chat' : selectedSubject ? 'subject-detail' : 'home');
        break;
    }
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  // Read the persisted onboarding flag once on boot (A1 fix).
  useEffect(() => {
    let cancelled = false;
    hasCompletedOnboarding().then((done) => {
      if (cancelled) return;
      setHasOnboarded(done);
      setOnboardingChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
  }, [currentScreen, hasOnboarded, fadeAnim, translateY]);

  // Android hardware / system back button: fire the same performBack() on
  // pushed screens (incl. quiz, which keeps its explicit Close). On tab roots
  // we return false so the OS closes the app normally.
  useEffect(() => {
    const onHardwareBack = () => {
      // The "Switch subject" picker is an overlay — back should dismiss it and
      // return to the workspace beneath, not run the workspace's own back.
      if (subjectPickerOpen) {
        setSubjectPickerOpen(false);
        return true;
      }
      // The chat sheet is a Modal — back should minimize it, not leave the
      // workspace. (RN fires both the Modal's onRequestClose and this listener,
      // so we consume it here first.)
      if (chatOpen) {
        setChatOpen(false);
        return true;
      }
      const pushed =
        currentScreen === 'summary' ||
        currentScreen === 'flashcards' ||
        currentScreen === 'subject-detail' ||
        currentScreen === 'quiz' ||
        currentScreen === 'quiz-setup' ||
        currentScreen === 'quiz-result';
      if (!pushed) return false;
      performBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
    // performBack closes over currentScreen + the return markers + quizOrigin +
    // selectedSubject; re-subscribe whenever any of those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen, chatReturnTo, summaryReturnTo, flashcardsReturnTo, subjectReturnTo, quizOrigin, selectedSubject]);

  if (!fontsLoaded || !onboardingChecked) {
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
    // Leaving for a root tab clears any pushed-screen back markers.
    clearReturnTos();
    setActiveTab(tab);
    setChatPrompt(undefined);
    switch (tab) {
      case 'home':
        setCurrentScreen('home');
        break;
      case 'subjects':
        setCurrentScreen('subjects');
        break;
      case 'profile':
        setCurrentScreen('profile');
        break;
    }
  };

  // Screen routing handlers
  const handleOpenPrompt = (promptText: string) => {
    // Action intents (quiz / summary / flashcards) need a subject to ground in.
    // If none is selected, route to the Subjects list so the user picks one
    // (NotebookLM model: chat always has a subject; never a contextless chat
    // screen with placeholder content).
    const origin = currentScreen;
    if (selectedSubject == null) {
      clearReturnTos();
      setChatPrompt(promptText);
      setActiveTab('subjects');
      setCurrentScreen('subjects');
      return;
    }
    switch (resolveRouting(promptText, false)) {
      case 'quiz':
        setQuizOrigin('quiz-setup');
        setCurrentScreen('quiz');
        break;
      case 'summary':
        clearReturnTos();
        setSummaryReturnTo(origin);
        setCurrentScreen('summary');
        break;
      case 'flashcards':
        clearReturnTos();
        setFlashcardsReturnTo(origin);
        setCurrentScreen('flashcards');
        break;
      case 'chat':
      default:
        // Open the matched subject's workspace with the prompt pre-filled.
        clearReturnTos();
        setSubjectReturnTo(origin === 'home' ? 'home' : 'subjects');
        setChatPrompt(promptText);
        setCurrentScreen('subject-detail');
        break;
    }
  };

  // Smart study box handoff (Slice 4): open the subject's workspace (sources +
  // chat in one surface) with the user's prompt pre-filled.
  const handleOpenChatWithSubject = (subject: SubjectItem, prompt: string) => {
    clearReturnTos();
    setSubjectReturnTo(currentScreen === 'home' ? 'home' : 'subjects');
    setSelectedSubject(subject);
    setChatPrompt(prompt);
    setCurrentScreen('subject-detail');
  };

  // ▾ workspace menu "Switch subject" → the subjects list.
  const handleSwitchWorkspaceSubject = () => {
    setSubjectPickerOpen(true);
  };

  // ▾ workspace menu "Rename subject".
  const handleRenameSubject = (id: number, name: string) => {
    updateSubject(id, { name })
      .then(() =>
        setSelectedSubject((s) => (s && parseInt(s.id, 10) === id ? { ...s, name } : s))
      )
      .catch((e: any) => Alert.alert('Rename failed', e?.message || 'Could not rename subject.'));
  };

  // ▾ workspace menu "Delete subject" → wipe materials/chat and return to list.
  const handleDeleteSubject = (id: number) => {
    deleteSubject(id)
      .then(() => {
        clearChatThread(id);
        setSelectedSubject(null);
        setActiveTab('subjects');
        setCurrentScreen('subjects');
      })
      .catch((e: any) => Alert.alert('Delete failed', e?.message || 'Could not delete subject.'));
  };

  // Opening a subject remembers which screen it came from so Back returns
  // there (Home's Continue/Recent Subjects -> home; Subjects tab -> subjects).
  const handleOpenSubject = (subject: SubjectItem) => {
    setSelectedSubject(subject);
    setSelectedMaterial(null);
    setSubjectReturnTo(currentScreen === 'home' ? 'home' : 'subjects');
    setCurrentScreen('subject-detail');
  };

  const subjectIdNum = selectedSubject ? parseInt(selectedSubject.id, 10) : undefined;
  const subjectName = selectedSubject?.name;

  const renderActiveScreen = () => {
    if (!hasOnboarded) {
      return (
        <OnboardingScreen
          onContinue={() => {
            setHasOnboarded(true);
            setOnboardingComplete();
            setCurrentScreen('home');
            setActiveTab('home');
          }}
          onSkip={() => {
            setHasOnboarded(true);
            setOnboardingComplete();
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
            onSelectSubject={handleOpenSubject}
            onOpenChatWithSubject={handleOpenChatWithSubject}
            guided={guidedCapture}
            onGuidedChange={setGuidedCapture}
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

      case 'subjects':
        return (
          <SubjectsScreen
            // Already on the subject library — the header menu is a no-op here
            // by design (it has nowhere else to go), kept explicit at the call
            // site rather than a silent () => {} buried in App.
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
          <SubjectWorkspaceScreen
            subject={selectedSubject}
            hideLeft
            onBack={performBack}
            onProfile={() => {
              setActiveTab('profile');
              setCurrentScreen('profile');
            }}
            onSwitchSubject={handleSwitchWorkspaceSubject}
            initialPrompt={chatPrompt}
            onStartQuiz={(prefs) => {
              setQuizPrefs({
                source: 'all',
                questionCount: prefs.questionCount,
                difficulty: prefs.difficulty,
                timeLimit: prefs.timeLimit,
              });
              setQuizOrigin('subject-detail');
              setCurrentScreen('quiz');
            }}
            onStartCards={(prefs) => {
              clearReturnTos();
              setFlashcardsReturnTo('subject-detail');
              setFlashcardPrefs({ source: 'all', cardCount: prefs.cardCount, focus: prefs.focus });
              setCurrentScreen('flashcards');
            }}
            onOpenQuizSetup={() => {
              setQuizOrigin('quiz-setup');
              setCurrentScreen('quiz-setup');
            }}
            onRenameSubject={handleRenameSubject}
            onDeleteSubject={handleDeleteSubject}
            chatOpen={chatOpen}
            onOpenChat={() => setChatOpen(true)}
            onCloseChat={() => setChatOpen(false)}
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
            hideLeft
            onBack={performBack}
            onCreateQuiz={() => { setQuizPrefs(null); setQuizOrigin('summary'); setCurrentScreen('quiz'); }}
            onCreateFlashcards={() => {
              clearReturnTos();
              setFlashcardsReturnTo('summary');
              setFlashcardPrefs(null);
              // Mark the launch context so deckTitle uses selectedMaterial only
              // here — never on later, unrelated flashcard launches.
              setFlashcardFromSummary(selectedMaterial != null);
              setCurrentScreen('flashcards');
            }}
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
            hideLeft
            onBack={performBack}
            subjectId={subjectIdNum}
            subjectName={subjectName}
            // Same stale-material guard as the quiz: only when the flashcards
            // were launched from a material's own context (its Summary screen).
            deckTitle={flashcardFromSummary && selectedMaterial ? `${selectedMaterial.filename} Deck` : undefined}
            {...(flashcardPrefs
              ? { cardCount: flashcardPrefs.cardCount, focus: flashcardPrefs.focus, sourceMaterialId: flashcardPrefs.source }
              : {})}
          />
        );

      case 'quiz':
        return (
          <QuizScreen
            onClose={() => setCurrentScreen(quizOrigin === 'chat' ? 'chat' : selectedSubject ? 'subject-detail' : 'home')}
            onPause={() => {
              // The old "Pause" unmounted the quiz and silently discarded
              // progress — a trap. Make it an explicit quit with confirm.
              Alert.alert(
                'Leave the quiz?',
                'Your progress in this quiz will not be saved.',
                [
                  { text: 'Keep playing', style: 'cancel' },
                  {
                    text: 'Leave quiz',
                    style: 'destructive',
                    onPress: () => setCurrentScreen(quizOrigin === 'chat' ? 'chat' : selectedSubject ? 'subject-detail' : 'home'),
                  },
                ],
                { cancelable: true }
              );
            }}
            onRetake={() => setCurrentScreen(quizOrigin === 'chat' ? 'chat' : 'quiz-setup')}
            subjectId={subjectIdNum}
            subjectName={subjectName}
            // Only scope the quiz to a material when the quiz was launched from
            // THAT material's context — never a stale selectedMaterial from an
            // earlier visit (old bug: any quiz after opening a summary got
            // quizzed on only that old file).
            topicTag={quizOrigin === 'summary' ? selectedMaterial?.filename : undefined}
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
                // Select the subject the attempt actually belongs to before
                // rebuilding the quiz — the previously selected subject could
                // be a different (or deleted) one.
                if (selectedAttempt.subjectId != null) {
                  setSelectedSubject({
                    id: String(selectedAttempt.subjectId),
                    name: selectedAttempt.subjectName,
                    materialsCount: 0,
                    mastery: null,
                  });
                }
                setSelectedAttempt(null);
                setSelectedMaterial(null);
                setQuizOrigin('quiz-setup');
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
          />
        );

      case 'onboarding':
        return (
          <OnboardingScreen
            onContinue={() => {
              setHasOnboarded(true);
              setOnboardingComplete();
              setCurrentScreen('home');
              setActiveTab('home');
            }}
            onSkip={() => {
              setHasOnboarded(true);
              setOnboardingComplete();
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
    hasOnboarded &&
    currentScreen !== 'quiz' &&
    currentScreen !== 'quiz-result' &&
    currentScreen !== 'quiz-setup' &&
    currentScreen !== 'flashcards' &&
    currentScreen !== 'onboarding';

  // iOS/web get the edge-swipe (Android is handled by BackHandler above; EdgeBack
  // renders null there). Covers the same pushed screens.
  const gestureBackActive =
    currentScreen === 'summary' ||
    currentScreen === 'flashcards' ||
    currentScreen === 'subject-detail';

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
          <ContentContainer>{renderActiveScreen()}</ContentContainer>
        </Animated.View>
        {showBottomNav && (
          <BottomNav currentTab={activeTab} onSelectTab={handleSelectTab} />
        )}
        {gestureBackActive && (
          <EdgeBack
            onBack={() => {
              if (subjectPickerOpen) setSubjectPickerOpen(false);
              else if (chatOpen) setChatOpen(false);
              else performBack();
            }}
          />
        )}
        {subjectPickerOpen && (
          <View style={styles.pickerOverlay}>
            <SubjectsScreen
              onOpenMenu={() => {}}
              onOpenProfile={() => {
                setActiveTab('profile');
                setCurrentScreen('profile');
              }}
              onSelectSubject={(subject) => {
                handleOpenSubject(subject);
                setSubjectPickerOpen(false);
              }}
              onClose={() => setSubjectPickerOpen(false)}
            />
          </View>
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
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: colors.background,
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
