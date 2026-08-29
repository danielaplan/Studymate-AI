import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { ScreenContextBar } from '../components/ScreenContextBar';
import { CardsSetupSheet, CardsPrefs } from '../components/CardsSetupSheet';
import { MasteryProgressBar } from '../components/MasteryProgressBar';
import { SparklesIcon, DocumentIcon, ScanIcon, ChevronRightIcon } from '../components/Icons';
import { SubjectItem, FocusArea, MasteryDetail } from '../types';
import { listMaterials, uploadMaterial, deleteMaterial, generateSummary, getSubjectMastery, MaterialAPI, SummaryAPI } from '../api/client';
import { getCachedSummary, setCachedSummary, clearCachedSummary } from '../storage/summaryCache';
import { addMemoryEntry, loadSubjectMemory, MemoryEntry, MemoryEntryType } from '../storage/subjectMemory';

interface SubjectDetailScreenProps {
  subject: SubjectItem;
  onBack: () => void;
  onProfile: () => void;
  onAskAI: () => void;
  onExplain?: (summary: SummaryAPI | null) => void;
  onStartQuiz?: () => void;
  onStartCards?: (prefs: CardsPrefs) => void;
  onOpenMaterial: (material: MaterialAPI) => void;
  onExpandSummary?: (summary: SummaryAPI) => void;
  // Hide the global header's left icon (menu) since back lives in the local bar.
  hideLeft?: boolean;
}

// Device-level (AsyncStorage) cache: keeps a generated summary per subject,
// keyed by how many source materials it was built from. Avoids re-summarizing
// on every tab/screen switch and survives app refresh/restart (no re-burn of
// AI quota). Only regenerates when the source set changes (new upload / delete).

// A summary is considered "failed" when the backend returned its fallback
// (generation was throttled/empty). We must not cache or display that as if
// it were a real summary — the user should be able to retry once the free
// pool recovers.
function isSummaryFailed(s: SummaryAPI | null): boolean {
  if (!s) return true;
  const paras = s.overview_paragraphs || [];
  if (paras.length === 0) return true;
  if ((paras[0] || '').includes('Summary unavailable')) return true;
  return false;
}

function activityEmoji(type: MemoryEntryType): string {
  switch (type) {
    case 'upload': return '📄';
    case 'quiz': return '🧠';
    case 'summary': return '✨';
    case 'cards': return '🃏';
    case 'chat': return '💬';
  }
}

function activityLabel(e: MemoryEntry): string {
  switch (e.type) {
    case 'upload': return `Uploaded "${e.fileName || 'file'}"`;
    case 'quiz': return `Quiz result: ${e.score}/${e.total} (${e.pct}%)`;
    case 'summary': return `Summary generated${e.title ? ` — ${e.title}` : ''}`;
    case 'cards': return `Flashcards: ${e.count ?? '?'} cards`;
    case 'chat': return `${e.role === 'user' ? 'You' : 'AI'}: ${e.text || ''}`;
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function SubjectDetailScreen({
  subject,
  onBack,
  onProfile,
  onAskAI,
  onExplain,
  onStartQuiz,
  onStartCards,
  onOpenMaterial,
  onExpandSummary,
  hideLeft,
}: SubjectDetailScreenProps) {
  const [materials, setMaterials] = useState<MaterialAPI[]>([]);
  const [summary, setSummary] = useState<SummaryAPI | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [cardsSetupVisible, setCardsSetupVisible] = useState(false);
  const [activity, setActivity] = useState<MemoryEntry[]>([]);
  const [masteryDetail, setMasteryDetail] = useState<MasteryDetail | null>(null);

  const subjectIdNum = parseInt(subject.id, 10);

  useEffect(() => {
    if (subjectIdNum) {
      loadMaterials();
      loadActivity();
      loadMastery();
    }
  }, [subject.id]);

  // Generate (or re-use cached) summary. Stores the result against the given
  // source count so future calls can skip the API when sources match.
  const loadSummary = async (sourceCount: number) => {
    setIsLoadingSummary(true);
    try {
      const data = await generateSummary(subjectIdNum);
      // Don't cache/overwrite a good summary with a throttled failure.
      if (isSummaryFailed(data)) return;
      await setCachedSummary(subjectIdNum, { summary: data, sourceCount });
      setSummary(data);
    } catch (error: any) {
      console.log('Could not load summary:', error?.message);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const data = await listMaterials(subjectIdNum);
      setMaterials(data);
      setMaterialsError(null);

      // Decide whether we need a fresh summary:
      // - no materials -> clear any cached summary
      // - matching source count in cache -> reuse it, no API call
      // - source count changed (upload/delete) -> regenerate
      const cached = await getCachedSummary(subjectIdNum);
      if (data.length === 0) {
        await clearCachedSummary(subjectIdNum);
        setSummary(null);
      } else if (cached && cached.sourceCount === data.length && !isSummaryFailed(cached.summary)) {
        setSummary(cached.summary);
      } else {
        loadSummary(data.length);
      }
    } catch (error: any) {
      setMaterialsError(error?.message || 'Could not load materials from the backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivity = () => {
    if (!subjectIdNum) return;
    loadSubjectMemory(subjectIdNum).then(setActivity).catch(() => {});
  };

  const loadMastery = () => {
    if (!subjectIdNum) return;
    getSubjectMastery(subjectIdNum)
      .then((d) => setMasteryDetail(d.assessed ? d : null))
      .catch(() => {});
  };

  const handlePickAndUpload = async () => {
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
        setIsUploading(true);
        const uploaded = await uploadMaterial(
          subjectIdNum,
          file.uri,
          file.name,
          file.mimeType || 'application/pdf',
          (file as any).file // on web DocumentPicker gives raw File object
        );
        await loadMaterials();
        await addMemoryEntry({
          type: 'upload',
          subjectId: subjectIdNum,
          timestamp: new Date().toISOString(),
          fileName: file.name,
        }).catch(() => {});
        loadActivity();
        Alert.alert(
          uploaded.processing_status === 'done' ? 'Upload complete' : 'Upload needs attention',
          uploaded.processing_status === 'done'
            ? `"${file.name}" has been parsed and indexed into your study materials.`
            : `"${file.name}" was saved, but could not be processed. Check the backend logs.`,
        );
      }
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMaterial = async (matId: number) => {
    try {
      await deleteMaterial(matId);
      setMaterials((prev) => prev.filter((m) => m.id !== matId));
    } catch (err: any) {
      Alert.alert('Delete failed', err.message);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      <Header onBack={onBack} onProfile={onProfile} hideLeft={hideLeft} />

      {/* Local back row only — subject name is already shown as the screen
          title below, so no tile here. Back lives in this bar, not in the
          global STUDYMATE header (which stays untouched for a future redesign). */}
      <ScreenContextBar onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Large Serif Title */}
        <Text style={styles.title}>{subject.name}</Text>

        <Text style={styles.lastStudiedMeta}>{subject.lastStudied || 'Ready for study session'}</Text>

        {/* AI Summary — green tile; shows the main idea, or a generate prompt */}
        <Pressable
          onPress={() => (summary ? onExpandSummary?.(summary) : loadSummary(materials.length))}
          disabled={isLoadingSummary || (!summary && materials.length === 0)}
          style={({ pressed }) => [styles.summaryTile, pressed && styles.rowPressed]}
        >
          <View style={styles.summaryTileIcon}>
            <SparklesIcon size={18} color={colors.brandGreen} />
          </View>
          <View style={styles.summaryTileTextWrap}>
            <Text style={styles.summaryTileTitle}>AI Summary</Text>
            <Text style={styles.summaryTileSub} numberOfLines={2}>
              {summary
                ? (summary.subtitle || summary.overview_paragraphs[0] || 'Tap to view your summary')
                : isLoadingSummary
                  ? 'Generating…'
                  : materials.length === 0
                    ? 'Upload notes to summarize'
                    : 'Generate from your notes'}
            </Text>
          </View>
          {isLoadingSummary ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <ChevronRightIcon size={16} color={colors.background} />
          )}
        </Pressable>

        {/* Subtle source files — tap to open the material used */}
        {summary && materials.length > 0 && (
          <View style={styles.sourceRow}>
            <Text style={styles.sourceLabel}>Sources</Text>
            <View style={styles.sourceChips}>
              {materials.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => onOpenMaterial(m)}
                  style={({ pressed }) => [styles.sourceChip, pressed && styles.sourceChipPressed]}
                >
                  <DocumentIcon size={12} color={colors.brandGreenDark} />
                  <Text style={styles.sourceChipText} numberOfLines={1}>
                    {m.filename}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.divider} />

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>QUICK ACTIONS</Text>

          <View style={styles.quickActionsRow}>
            <Pressable
              accessibilityLabel="Upload new materials"
              onPress={handlePickAndUpload}
              disabled={isUploading}
              style={({ pressed }) => [styles.quickPill, styles.quickPillHighlight, pressed && styles.rowPressed]}
            >
              <DocumentIcon size={15} color={colors.background} />
              <Text style={styles.quickPillTextHighlight}>{isUploading ? 'Uploading…' : 'Upload'}</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Scan handwritten notes"
              onPress={handlePickAndUpload}
              disabled={isUploading}
              style={({ pressed }) => [styles.quickPill, styles.quickPillHighlight, pressed && styles.rowPressed]}
            >
              <ScanIcon size={15} color={colors.background} />
              <Text style={styles.quickPillTextHighlight}>Scan</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Explain concepts"
              onPress={() => onExplain?.(summary)}
              style={({ pressed }) => [styles.quickPill, pressed && styles.rowPressed]}
            >
              <SparklesIcon size={15} color={colors.brandGreen} />
              <Text style={styles.quickPillText}>Explain</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Generate quiz"
              onPress={() => onStartQuiz?.()}
              style={({ pressed }) => [styles.quickPill, pressed && styles.rowPressed]}
            >
              <SparklesIcon size={15} color={colors.brandGreen} />
              <Text style={styles.quickPillText}>Quiz</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Make flashcards"
              onPress={() => onStartCards ? setCardsSetupVisible(true) : onAskAI()}
              style={({ pressed }) => [styles.quickPill, pressed && styles.rowPressed]}
            >
              <SparklesIcon size={15} color={colors.brandGreen} />
              <Text style={styles.quickPillText}>Cards</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Study Materials */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionOverline}>STUDY MATERIALS</Text>
            {isLoading && <ActivityIndicator size="small" color={colors.brandGreen} />}
          </View>

          <View style={styles.materialsList}>
            {materialsError && (
              <View style={styles.emptyMaterialsCard}>
                <Text style={styles.emptyMaterialsTitle}>Materials could not be loaded</Text>
                <Text style={styles.emptyMaterialsSubtitle}>{materialsError}</Text>
                <Pressable onPress={loadMaterials} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            )}
            {materials.map((item) => (
              <Pressable
                key={item.id}
                accessibilityLabel={`Open ${item.filename}`}
                onPress={() => onOpenMaterial(item)}
                style={({ pressed }) => [styles.materialRow, pressed && styles.rowPressed]}
              >
                <View style={styles.materialDocBadge}>
                  <DocumentIcon size={16} color={colors.brandGreen} />
                </View>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialTitle}>{item.filename}</Text>
                  <Text style={styles.materialMeta}>
                    {item.file_type.toUpperCase()} • {formatFileSize(item.file_size_bytes)} • {item.chunks_count} chunks
                  </Text>
                </View>
                <ChevronRightIcon size={16} color={colors.textMuted} />
              </Pressable>
            ))}

            {materials.length === 0 && !isLoading && !materialsError && (
              <View style={styles.emptyMaterialsCard}>
                <Text style={styles.emptyMaterialsTitle}>No materials uploaded yet</Text>
                <Text style={styles.emptyMaterialsSubtitle}>
                  Tap "Upload PDF / study material" above to parse your notes with OCR and start studying.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Mastery — real score derived from quiz performance (not editable) */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>MASTERY</Text>

          {masteryDetail ? (
            <>
              <View style={styles.masteryBlock}>
                <View style={styles.masteryHeadRow}>
                  <Text style={styles.masteryTitle}>Overall mastery</Text>
                  <Text style={styles.masteryPct}>{masteryDetail.overall}%</Text>
                </View>
                <MasteryProgressBar
                  percentage={masteryDetail.overall}
                  showText={false}
                  width={'100%'}
                />
              </View>

              {(() => {
                const focusAreas = [...masteryDetail.byTopic]
                  .sort((a, b) => a.mastery - b.mastery)
                  .slice(0, 3);
                if (focusAreas.length === 0) return null;
                return (
                  <>
                    <Text style={styles.focusOverline}>FOCUS AREAS</Text>
                    {focusAreas.map((fa: FocusArea) => (
                      <View key={fa.topic} style={styles.focusRow}>
                        <Text style={styles.focusTopic} numberOfLines={1}>
                          {fa.topic}
                        </Text>
                        <MasteryProgressBar
                          percentage={fa.mastery}
                          showText={false}
                          width={80}
                        />
                        <Text style={styles.focusPct}>{fa.mastery}%</Text>
                      </View>
                    ))}
                  </>
                );
              })()}
            </>
          ) : (
            <View style={styles.emptyMaterialsCard}>
              <Text style={styles.emptyMaterialsTitle}>Not yet assessed</Text>
              <Text style={styles.emptyMaterialsSubtitle}>
                Take a quiz in this subject to see your real mastery and the topics to focus on.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Activity / on-device memory timeline for this subject */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>ACTIVITY</Text>
          {activity.length > 0 ? (
            <View style={styles.activityList}>
              {activity.slice(0, 30).map((e) => (
                <View key={e.id} style={styles.activityRow}>
                  <Text style={styles.activityIcon}>{activityEmoji(e.type)}</Text>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityText} numberOfLines={2}>
                      {activityLabel(e)}
                    </Text>
                    <Text style={styles.activityTime}>{formatRelative(e.timestamp)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyMaterialsCard}>
              <Text style={styles.emptyMaterialsTitle}>No activity yet</Text>
              <Text style={styles.emptyMaterialsSubtitle}>
                Uploads, quizzes, summaries, flashcards and chats in this subject will be
                remembered here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <CardsSetupSheet
        visible={cardsSetupVisible}
        subjectId={subjectIdNum}
        subjectName={subject.name}
        materials={materials}
        onClose={() => setCardsSetupVisible(false)}
        onStart={(prefs) => {
          setCardsSetupVisible(false);
          onStartCards?.(prefs);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },
  breadcrumbRow: { marginBottom: 8 },
  breadcrumbText: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5 },
  title: { fontFamily: typography.display, fontSize: 34, color: colors.textPrimary, marginBottom: 12, letterSpacing: -0.8 },
  lastStudiedMeta: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 14 },
  section: { paddingVertical: 8 },
  sectionOverline: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 16 },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickPillText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  quickPillHighlight: {
    backgroundColor: colors.brandGreen,
    borderColor: colors.brandGreen,
  },
  quickPillTextHighlight: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: colors.background,
  },
  summaryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.brandGreen,
    borderRadius: 16,
    shadowColor: '#243C2C',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  summaryTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTileTextWrap: { flex: 1 },
  summaryTileTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.background,
  },
  summaryTileSub: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  masteryBlock: {
    backgroundColor: '#F9F7F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 14,
  },
  masteryHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  masteryTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  masteryPct: {
    fontFamily: typography.serifBold,
    fontSize: 20,
    color: colors.brandGreenDark,
  },
  focusOverline: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  focusTopic: {
    flex: 1,
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  focusPct: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textMuted,
    minWidth: 38,
    textAlign: 'right',
  },
  materialsList: {
    backgroundColor: '#F9F7F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.025,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  materialRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 12 },
  materialDocBadge: { width: 30, height: 34, backgroundColor: colors.sageBadge, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  materialInfo: { flex: 1 },
  materialTitle: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.textPrimary },
  materialMeta: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowPressed: { opacity: 0.75 },
  emptyMaterialsCard: { padding: 24, alignItems: 'center', gap: 6 },
  emptyMaterialsTitle: { fontFamily: typography.display, fontSize: 17, color: colors.textPrimary },
  emptyMaterialsSubtitle: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retryButton: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.brandGreen, borderRadius: 10 },
  retryButtonText: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.background },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.brandGreenLight,
    gap: 8,
    flexWrap: 'wrap',
  },
  sourceLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 10,
    color: colors.brandGreenDark,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sourceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 150,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.brandGreenLight,
  },
  sourceChipPressed: {
    opacity: 0.6,
    backgroundColor: colors.sageBadge,
  },
  sourceChipText: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.brandGreenDark,
  },
  activityList: {
    backgroundColor: '#F9F7F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  activityIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  activityInfo: { flex: 1 },
  activityText: { fontFamily: typography.sansMedium, fontSize: 13, color: colors.textPrimary },
  activityTime: { fontFamily: typography.sansRegular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
