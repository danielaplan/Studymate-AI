import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { PaperclipIcon, DocumentIcon, CloseIcon, ChevronRightIcon } from '../components/Icons';
import { QuickActionPill } from '../components/QuickActionPill';
import { MasteryProgressBar } from '../components/MasteryProgressBar';
import { SubjectItem, QuizAttempt } from '../types';
import { loadQuizHistory } from '../storage/quizHistory';
import { addMemoryEntry } from '../storage/subjectMemory';
import { listSubjects, createSubject, uploadMaterial, extractTextAndSuggestTitle, SubjectAPI } from '../api/client';

interface HomeScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onSelectPrompt: (prompt: string) => void;
  onOpenContinueSubject: () => void;
  onSelectSubject: (subject: SubjectItem) => void;
  onOpenQuizResult: (attempt: QuizAttempt) => void;
}

function quizBand(pct: number): string {
  if (pct >= 80) return colors.brandGreen;
  if (pct >= 50) return '#E2A23B';
  return '#D9694E';
}

function masteryLabel(mastery: number | null): string {
  return mastery == null ? 'Not yet assessed' : `${mastery}% Mastery`;
}

function formatAttemptDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function apiToSubjectItem(api: SubjectAPI): SubjectItem {
  return {
    id: String(api.id),
    name: api.name,
    materialsCount: api.materials_count,
    mastery: api.mastery == null ? null : Math.round(api.mastery),
    description: api.description,
    pinned: api.pinned,
  };
}

// Picks a single study recommendation from the loaded subjects, using only the
// data HomeScreen already has (overall mastery per subject — no extra fetches).
// Priority: (1) an unassessed subject -> nudge to take a first quiz,
// (2) the weakest assessed subject below a threshold -> focus there,
// (3) everything assessed and healthy -> encouragement,
// (4) no subjects at all -> neutral prompt. Returns a headline string.
function buildRecommendation(items: SubjectItem[]): string {
  if (items.length === 0) {
    return 'Add a subject and take a quiz to see your study pulse.';
  }
  const unassessed = items.find((s) => s.mastery == null);
  if (unassessed) {
    return `Take your first quiz in ${unassessed.name} to measure mastery.`;
  }
  const assessed = items.filter((s) => s.mastery != null) as Array<SubjectItem & { mastery: number }>;
  const weakest = assessed.reduce(
    (min, s) => ((s.mastery as number) < (min.mastery as number) ? s : min),
    assessed[0]
  );
  if (weakest.mastery < 60) {
    return `Focus on ${weakest.name} — your weakest subject (${weakest.mastery}%).`;
  }
  const avg = Math.round(assessed.reduce((sum, s) => sum + (s.mastery as number), 0) / assessed.length);
  return `Strong progress — ${avg}% average mastery across ${assessed.length} subjects.`;
}

export function HomeScreen({
  onOpenMenu,
  onOpenProfile,
  onSelectPrompt,
  onOpenContinueSubject,
  onSelectSubject,
  onOpenQuizResult,
}: HomeScreenProps) {
  const [inputPrompt, setInputPrompt] = useState('');
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const [subjectsLoadFailed, setSubjectsLoadFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // Modal to choose subject if multiple exist when uploading from Home
  const [pendingFile, setPendingFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [showSubjectPickerModal, setShowSubjectPickerModal] = useState(false);
  // Shown after a file is picked (when subjects exist) to decide: new subject vs existing.
  const [showUploadTargetModal, setShowUploadTargetModal] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    setIsLoading(true);
    try {
      const data = await listSubjects();
      setSubjects(data.map(apiToSubjectItem));
      setSubjectsLoadFailed(false);
      loadQuizHistory().then(setHistory).catch(() => {});
    } catch {
      setSubjects([]);
      setSubjectsLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Creates a fresh subject from a file (analyzes it, auto-names from the
  // AI-suggested title) and uploads the file into it. Used both when there are
  // no subjects yet and when the user explicitly chooses "new subject".
  const createNewSubjectFromFile = async (file: DocumentPicker.DocumentPickerAsset) => {
    setIsUploading(true);
    setUploadStatus('Analyzing document...');
    try {
      const extractResult = await extractTextAndSuggestTitle(
        file.uri,
        file.name,
        file.mimeType || 'application/pdf',
        (file as any).file
      );
      const suggestedTitle = extractResult.suggested_title || 'Study Notes';

      setUploadStatus(`Creating "${suggestedTitle}"...`);
      const newSub = await createSubject(suggestedTitle);

      setUploadStatus('Indexing content...');
      const uploaded = await uploadMaterial(
        newSub.id,
        file.uri,
        file.name,
        file.mimeType || 'application/pdf',
        (file as any).file
      );
      await addMemoryEntry({
        type: 'upload',
        subjectId: newSub.id,
        timestamp: new Date().toISOString(),
        fileName: file.name,
      });
      await loadSubjects();
      setIsUploading(false);
      setUploadStatus('');
      Alert.alert(
        'Upload Successful! 📄',
        `"${file.name}" was parsed (${uploaded.chunks_count} chunks) and added to "${suggestedTitle}".`,
        [
          {
            text: 'View Notes',
            onPress: () => onSelectSubject(apiToSubjectItem(newSub)),
          },
          { text: 'OK' },
        ]
      );
    } catch {
      setIsUploading(false);
      setUploadStatus('');
      // Fallback to generic title if extraction fails
      setUploadStatus('Creating workspace...');
      try {
        const newSub = await createSubject('Study Notes');
        const uploaded = await uploadMaterial(
          newSub.id,
          file.uri,
          file.name,
          file.mimeType || 'application/pdf',
          (file as any).file
        );
        await addMemoryEntry({
          type: 'upload',
          subjectId: newSub.id,
          timestamp: new Date().toISOString(),
          fileName: file.name,
        });
        await loadSubjects();
        setIsUploading(false);
        setUploadStatus('');
        Alert.alert(
          'Upload Complete! 📄',
          `"${file.name}" was parsed (${uploaded.chunks_count} chunks) indexed into "Study Notes".`,
          [
            {
              text: 'Open Subject',
              onPress: () => onSelectSubject(apiToSubjectItem(newSub)),
            },
            { text: 'OK' },
          ]
        );
      } catch (fallbackErr: any) {
        Alert.alert('Upload Error', fallbackErr.message || 'Could not upload file.');
      }
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/*', 'application/json', 'application/xml', 'image/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // No subjects yet — always create a new subject from the file.
        // Otherwise ask the user: create a new subject or add to an existing one.
        if (subjects.length === 0) {
          await createNewSubjectFromFile(file);
        } else {
          setPendingFile(file);
          setShowUploadTargetModal(true);
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
      await addMemoryEntry({
        type: 'upload',
        subjectId: parseInt(sub.id, 10),
        timestamp: new Date().toISOString(),
        fileName: pendingFile.name,
      });
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

  const totalNotes = subjects.reduce((s, sub) => s + sub.materialsCount, 0);
  const assessedSubjects = subjects.filter((sub) => sub.mastery != null);
  const avgMastery = assessedSubjects.length
    ? Math.round(assessedSubjects.reduce((s, sub) => s + (sub.mastery as number), 0) / assessedSubjects.length)
    : 0;
  // Hide any recent-quiz entry whose subject no longer exists (e.g. it was
  // deleted). This is a safety net on top of clearing quiz history on delete,
  // so the list self-corrects as soon as subjects reload. If subjects failed
  // to load we can't know what exists, so we show everything.
  const subjectIds = useMemo(() => new Set(subjects.map((s) => s.id)), [subjects]);
  const visibleHistory = subjectsLoadFailed
    ? history
    : history.filter((a) => a.subjectId == null || subjectIds.has(String(a.subjectId)));

  const quizCount = visibleHistory.length;

  // Personalized study-pulse headline derived from the loaded subjects.
  const recommendation = useMemo(() => buildRecommendation(subjects), [subjects]);

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

          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <Text style={styles.summaryEyebrow}>Study pulse</Text>
              <Text style={styles.summaryBadge}>
                {visibleHistory.length > 0 ? `Last ${visibleHistory[0].pct}%` : 'No quizzes yet'}
              </Text>
            </View>
            <Text style={styles.summaryHeadline}>{recommendation}</Text>
            <View style={styles.summaryMetrics}>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{totalNotes}</Text>
                <Text style={styles.metricLabel}>notes</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{avgMastery}%</Text>
                <Text style={styles.metricLabel}>mastery</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{quizCount}</Text>
                <Text style={styles.metricLabel}>quizzes</Text>
              </View>
            </View>
          </View>

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
                  {continueSubject.materialsCount} study material(s) • {masteryLabel(continueSubject.mastery)}
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
                  <View style={styles.subjectMasteryWrap}>
                    <MasteryProgressBar percentage={sub.mastery} width={90} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptySubjectsBox}>
              <Text style={styles.emptySubjectsText}>Your created subjects will appear here.</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Recent quizzes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent quizzes</Text>
          {visibleHistory.length > 0 ? (
            <View style={styles.quizHistoryList}>
              {visibleHistory.map((attempt) => (
                <Pressable
                  key={attempt.id}
                  accessibilityLabel={`Open quiz result for ${attempt.subjectName}`}
                  onPress={() => onOpenQuizResult(attempt)}
                  style={({ pressed }) => [styles.quizHistoryRow, pressed && styles.cardPressed]}
                >
                  <View style={[styles.quizHistoryDot, { backgroundColor: quizBand(attempt.pct) }]} />
                  <View style={styles.quizHistoryInfo}>
                    <Text style={styles.quizHistorySubject}>{attempt.subjectName}</Text>
                    <Text style={styles.quizHistoryMeta}>
                      {attempt.score}/{attempt.total} • {attempt.pct}%
                      {attempt.difficulty ? ` • ${attempt.difficulty}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.quizHistoryDate}>{formatAttemptDate(attempt.createdAt)}</Text>
                  <ChevronRightIcon size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptySubjectsBox}>
              <Text style={styles.emptySubjectsText}>No quizzes yet — finish a quiz to track it here.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal: choose new subject vs existing subject after picking a file */}
      <Modal
        visible={showUploadTargetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadTargetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to a subject?</Text>
            <Text style={styles.modalSubtitle}>
              "{pendingFile?.name}" — create a new subject or add it to an existing one?
            </Text>
            <Pressable
              accessibilityLabel="Create new subject"
              onPress={() => {
                setShowUploadTargetModal(false);
                if (pendingFile) createNewSubjectFromFile(pendingFile);
              }}
              style={({ pressed }) => [styles.modalSubjectItem, pressed && styles.cardPressed]}
            >
              <View style={styles.modalDocBadge}>
                <DocumentIcon size={16} color={colors.brandGreen} />
              </View>
              <Text style={styles.modalSubjectName}>Create new subject</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Add to existing subject"
              onPress={() => {
                setShowUploadTargetModal(false);
                setShowSubjectPickerModal(true);
              }}
              style={({ pressed }) => [styles.modalSubjectItem, pressed && styles.cardPressed]}
            >
              <View style={styles.modalDocBadge}>
                <DocumentIcon size={16} color={colors.brandGreen} />
              </View>
              <Text style={styles.modalSubjectName}>Add to existing subject</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
    paddingTop: 22,
    paddingBottom: 20,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  inputField: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: 17,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
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
  summaryCard: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#F7F5F1',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryEyebrow: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  summaryBadge: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: colors.brandGreen,
    backgroundColor: colors.brandGreenSoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  summaryHeadline: {
    marginTop: 10,
    fontFamily: typography.display,
    fontSize: 22,
    color: colors.brandGreenDark,
    letterSpacing: -0.5,
  },
  summaryMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  metricPill: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  metricValue: {
    fontFamily: typography.serifBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  metricLabel: {
    marginTop: 4,
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.textMuted,
  },
  quickPillsWrapper: {
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
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
    fontFamily: typography.display,
    fontSize: 22,
    color: colors.brandGreenDark,
    marginBottom: 18,
    letterSpacing: -0.4,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 22,
    padding: 16,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  documentBadge: {
    width: 42,
    height: 48,
    backgroundColor: colors.brandGreenSoft,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontFamily: typography.serifSemiBold,
    fontSize: 18,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    flex: 1,
    flexShrink: 1,
    marginRight: 12,
  },
  subjectMasteryWrap: {
    flexShrink: 0,
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
  quizHistoryList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  quizHistoryRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  quizHistoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  quizHistoryInfo: {
    flex: 1,
  },
  quizHistorySubject: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  quizHistoryMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  quizHistoryDate: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
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
