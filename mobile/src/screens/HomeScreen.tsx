import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { PaperclipIcon, DocumentIcon } from '../components/Icons';
import { QuickActionPill } from '../components/QuickActionPill';
import { MasteryProgressBar } from '../components/MasteryProgressBar';
import { SubjectItem } from '../types';

interface HomeScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onSelectPrompt: (prompt: string) => void;
  onOpenContinueSubject: () => void;
  onSelectSubject: (subject: SubjectItem) => void;
}

const RECENT_SUBJECTS: SubjectItem[] = [
  { id: '1', name: 'Programming', materialsCount: 14, mastery: 75 },
  { id: '2', name: 'Info Assurance', materialsCount: 9, mastery: 40 },
  { id: '3', name: 'Mathematics', materialsCount: 11, mastery: 90 },
];

export function HomeScreen({
  onOpenMenu,
  onOpenProfile,
  onSelectPrompt,
  onOpenContinueSubject,
  onSelectSubject,
}: HomeScreenProps) {
  const [inputPrompt, setInputPrompt] = useState('');

  const handleSubmit = () => {
    if (!inputPrompt.trim()) return;
    onSelectPrompt(inputPrompt.trim());
    setInputPrompt('');
  };

  return (
    <View style={styles.container}>
      <Header onMenu={onOpenMenu} onProfile={onOpenProfile} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Main Prompt Input Area */}
        <View style={styles.promptSection}>
          <View style={styles.promptRow}>
            <TextInput
              placeholder="What are we studying today?"
              placeholderTextColor={colors.textPlaceholder}
              value={inputPrompt}
              onChangeText={setInputPrompt}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              style={styles.inputField}
            />
            <Pressable
              accessibilityLabel="Attach study notes"
              onPress={() => handleSubmit()}
              style={styles.attachBtn}
            >
              <PaperclipIcon size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.quickPillsWrapper}>
            <QuickActionPill
              label="Summarize last lecture"
              onPress={() => onSelectPrompt('Summarize last lecture')}
            />
            <QuickActionPill
              label="Quiz me on Chapter 4"
              onPress={() => onSelectPrompt('Quiz me on Chapter 4')}
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Continue Studying Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continue Studying</Text>

          <Pressable
            accessibilityLabel="Continue Chapter 3"
            onPress={onOpenContinueSubject}
            style={({ pressed }) => [styles.continueCard, pressed && styles.cardPressed]}
          >
            <View style={styles.documentBadge}>
              <DocumentIcon size={20} color={colors.brandGreen} />
            </View>

            <View style={styles.continueInfo}>
              <Text style={styles.chapterTitle}>
                Chapter 3: Symmetric{'\n'}Encryption Standards
              </Text>
              <Text style={styles.chapterMeta}>
                Info Assurance • Last active 2 hours ago
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {/* Recent Subjects Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Subjects</Text>

          <View style={styles.subjectsList}>
            {RECENT_SUBJECTS.map((sub) => (
              <Pressable
                key={sub.id}
                accessibilityLabel={`Open subject ${sub.name}`}
                onPress={() => onSelectSubject(sub)}
                style={({ pressed }) => [styles.subjectRow, pressed && styles.cardPressed]}
              >
                <Text style={styles.subjectName}>{sub.name}</Text>
                <MasteryProgressBar percentage={sub.mastery} width={90} />
              </Pressable>
            ))}
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
    paddingBottom: 32,
  },
  promptSection: {
    paddingTop: 36,
    paddingBottom: 28,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMedium,
    paddingBottom: 10,
  },
  inputField: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: 18,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  attachBtn: {
    padding: 6,
  },
  quickPillsWrapper: {
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
  },
  section: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontFamily: typography.serifSemiBold,
    fontSize: 22,
    color: colors.brandGreenDark,
    marginBottom: 20,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  documentBadge: {
    width: 38,
    height: 48,
    backgroundColor: colors.sageBadge,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontFamily: typography.serifSemiBold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  chapterMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  subjectsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
  },
  subjectRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  subjectName: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardPressed: {
    opacity: 0.75,
  },
});
