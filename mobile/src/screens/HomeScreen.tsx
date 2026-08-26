import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { PaperclipIcon, DocumentIcon, CloseIcon } from '../components/Icons';
import { QuickActionPill } from '../components/QuickActionPill';
import { MasteryProgressBar } from '../components/MasteryProgressBar';
import { SubjectItem } from '../types';
import { listSubjects, createSubject, uploadMaterial, SubjectAPI } from '../api/client';

interface HomeScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onSelectPrompt: (prompt: string) => void;
  onOpenContinueSubject: () => void;
  onSelectSubject: (subject: SubjectItem) => void;
}

function apiToSubjectItem(api: SubjectAPI): SubjectItem {
  return {
    id: String(api.id),
    name: api.name,
    materialsCount: api.materials_count,
    mastery: Math.round(api.mastery),
    description: api.description,
  };
}

export function HomeScreen({
  onOpenMenu,
  onOpenProfile,
  onSelectPrompt,
  onOpenContinueSubject,
  onSelectSubject,
}: HomeScreenProps) {
  const [inputPrompt, setInputPrompt] = useState('');
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // Modal to choose subject if multiple exist when uploading from Home
  const [pendingFile, setPendingFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [showSubjectPickerModal, setShowSubjectPickerModal] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    setIsLoading(true);
    try {
      const data = await listSubjects();
      setSubjects(data.map(apiToSubjectItem));
    } catch {
      setSubjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // If no subjects exist, automatically create a "General Notes" subject
        if (subjects.length === 0) {
          setIsUploading(true);
          setUploadStatus('Creating workspace & parsing notes...');
          const newSub = await createSubject('General Notes', 'Auto-created workspace for uploaded notes');
          const uploaded = await uploadMaterial(
            newSub.id,
            file.uri,
            file.name,
            file.mimeType || 'application/pdf',
            (file as any).file
          );
          await loadSubjects();
          setIsUploading(false);
          setUploadStatus('');
          Alert.alert(
            'Upload Successful! 📄',
            `"${file.name}" was parsed (${uploaded.chunks_count} chunks) and added to "General Notes".`,
            [
              {
                text: 'View Notes',
                onPress: () => onSelectSubject(apiToSubjectItem(newSub)),
              },
              { text: 'OK' },
            ]
          );
        } else if (subjects.length === 1) {
          // Exactly 1 subject: upload directly to it
          const targetSub = subjects[0];
          setIsUploading(true);
          setUploadStatus(`Parsing "${file.name}"...`);
          const uploaded = await uploadMaterial(
            parseInt(targetSub.id, 10),
            file.uri,
            file.name,
            file.mimeType || 'application/pdf',
            (file as any).file
          );
          await loadSubjects();
          setIsUploading(false);
          setUploadStatus('');
          Alert.alert(
            'Upload Complete! 📄',
            `"${file.name}" (${uploaded.chunks_count} chunks) indexed into "${targetSub.name}".`,
            [
              {
                text: 'Open Subject',
                onPress: () => onSelectSubject(targetSub),
              },
              { text: 'OK' },
            ]
          );
        } else {
          // Multiple subjects: open quick selection modal
          setPendingFile(file);
          setShowSubjectPickerModal(true);
        }
      }
    } catch (err: any) {
      setIsUploading(false);
      setUploadStatus('');
      Alert.alert('Upload Error', err.message || 'Could not pick or upload file.');
    }
  };

  const handleUploadToSubject = async (sub: SubjectItem) => {
    if (!pendingFile) return;
    setShowSubjectPickerModal(false);
    setIsUploading(true);
    setUploadStatus(`Parsing "${pendingFile.name}" for ${sub.name}...`);
    try {
      const uploaded = await uploadMaterial(
        parseInt(sub.id, 10),
        pendingFile.uri,
        pendingFile.name,
        pendingFile.mimeType || 'application/pdf',
        (pendingFile as any).file
      );
      await loadSubjects();
      Alert.alert(
        'Upload Complete! 📄',
        `"${pendingFile.name}" (${uploaded.chunks_count} chunks) added to "${sub.name}".`,
        [
          { text: 'Open Subject', onPress: () => onSelectSubject(sub) },
          { text: 'OK' },
        ]
      );
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Error uploading file.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      setPendingFile(null);
    }
  };

  const handleSubmit = () => {
    if (!inputPrompt.trim()) return;
    onSelectPrompt(inputPrompt.trim());
    setInputPrompt('');
  };

  const hasSubjects = subjects.length > 0;
  const continueSubject = hasSubjects ? subjects[0] : null;

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
              onPress={handlePickDocument}
              disabled={isUploading}
              style={({ pressed }) => [styles.attachBtn, pressed && styles.attachBtnPressed]}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.brandGreen} />
              ) : (
                <PaperclipIcon size={20} color={colors.brandGreen} />
              )}
            </Pressable>
          </View>

          {isUploading && (
            <View style={styles.uploadProgressRow}>
              <ActivityIndicator size="small" color={colors.brandGreen} />
              <Text style={styles.uploadProgressText}>{uploadStatus || 'Processing file...'}</Text>
            </View>
          )}

          <View style={styles.quickPillsWrapper}>
            <QuickActionPill
              label="Summarize my notes"
              onPress={() => onSelectPrompt('Summarize my notes')}
            />
            <QuickActionPill
              label="Quiz me on my materials"
              onPress={() => onSelectPrompt('Quiz me on my materials')}
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Continue Studying Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continue Studying</Text>

          {continueSubject ? (
            <Pressable
              accessibilityLabel={`Continue ${continueSubject.name}`}
              onPress={() => onSelectSubject(continueSubject)}
              style={({ pressed }) => [styles.continueCard, pressed && styles.cardPressed]}
            >
              <View style={styles.documentBadge}>
                <DocumentIcon size={20} color={colors.brandGreen} />
              </View>

              <View style={styles.continueInfo}>
                <Text style={styles.chapterTitle}>{continueSubject.name}</Text>
                <Text style={styles.chapterMeta}>
                  {continueSubject.materialsCount} study material(s) • {continueSubject.mastery}% Mastery
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="Add subject"
              onPress={handlePickDocument}
              style={({ pressed }) => [styles.emptyStateCard, pressed && styles.cardPressed]}
            >
              <View style={styles.emptyIconBadge}>
                <PaperclipIcon size={20} color={colors.brandGreen} />
              </View>
              <Text style={styles.emptyStateTitle}>Upload notes to start studying</Text>
              <Text style={styles.emptyStateSubtitle}>
                Tap here or the paperclip icon above to upload your first PDF or image notes.
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.divider} />

        {/* Recent Subjects Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Subjects</Text>
            {isLoading && <ActivityIndicator size="small" color={colors.brandGreen} />}
          </View>

          {hasSubjects ? (
            <View style={styles.subjectsList}>
              {subjects.map((sub) => (
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
          ) : (
            <View style={styles.emptySubjectsBox}>
              <Text style={styles.emptySubjectsText}>Your created subjects will appear here.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal for choosing subject when uploading from Home */}
      <Modal
        visible={showSubjectPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubjectPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Subject</Text>
              <Pressable onPress={() => setShowSubjectPickerModal(false)} style={styles.modalCloseBtn}>
                <CloseIcon size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              Select which subject folder to add "{pendingFile?.name}" to:
            </Text>
            <ScrollView style={styles.modalSubjectList}>
              {subjects.map((sub) => (
                <Pressable
                  key={sub.id}
                  onPress={() => handleUploadToSubject(sub)}
                  style={({ pressed }) => [styles.modalSubjectItem, pressed && styles.cardPressed]}
                >
                  <View style={styles.modalDocBadge}>
                    <DocumentIcon size={16} color={colors.brandGreen} />
                  </View>
                  <Text style={styles.modalSubjectName}>{sub.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FAFBF8',
  },
  attachBtnPressed: {
    backgroundColor: colors.sageBadge,
  },
  uploadProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  uploadProgressText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.brandGreen,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: typography.serifSemiBold,
    fontSize: 22,
    color: colors.brandGreenDark,
    marginBottom: 20,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginTop: 4,
  },
  emptyStateCard: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  emptyIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.sageBadge,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyStateTitle: {
    fontFamily: typography.serifSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  emptyStateSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
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
  emptySubjectsBox: {
    padding: 24,
    backgroundColor: '#FAFBF8',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptySubjectsText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textMuted,
  },
  cardPressed: {
    opacity: 0.75,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: typography.serifBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalSubjectList: {
    maxHeight: 240,
    marginTop: 8,
  },
  modalSubjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 8,
    gap: 12,
  },
  modalDocBadge: {
    width: 28,
    height: 32,
    backgroundColor: colors.sageBadge,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubjectName: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
