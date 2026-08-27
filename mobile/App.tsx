import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
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
import { ScreenName, TabName, SubjectItem } from './src/types';
import { BottomNav } from './src/components/BottomNav';
import { MaterialAPI } from './src/api/client';

// Screenskimi
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { SubjectsScreen } from './src/screens/SubjectsScreen';
import { SubjectDetailScreen } from './src/screens/SubjectDetailScreen';
import { FlashcardsScreen } from './src/screens/FlashcardsScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { QuizScreen } from './src/screens/QuizScreen';
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

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialAPI | null>(null);
  const [chatPrompt, setChatPrompt] = useState<string | undefined>(undefined);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brandGreen} />
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
              setActiveTab('chat');
              setCurrentScreen('chat');
            }}
            onOpenMaterial={handleOpenMaterial}
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
            onCreateQuiz={() => setCurrentScreen('quiz')}
            onCreateFlashcards={() => setCurrentScreen('flashcards')}
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
          />
        );

      case 'quiz':
        return (
          <QuizScreen
            onClose={() => setCurrentScreen(selectedSubject ? 'subject-detail' : 'home')}
            onPause={() => setCurrentScreen('home')}
            subjectId={subjectIdNum}
            subjectName={subjectName}
            topicTag={selectedMaterial?.filename}
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
    currentScreen !== 'onboarding';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={styles.screenContainer}>{renderActiveScreen()}</View>
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
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
