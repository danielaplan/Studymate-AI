import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  TextInput,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { ScreenContextBar } from '../components/ScreenContextBar';
import { SourcesPanel } from '../components/SourcesPanel';
import { ChatScreen } from './ChatScreen';
import { ChatContextMenu } from '../components/ChatContextMenu';
import { CardsSetupSheet, CardsPrefs } from '../components/CardsSetupSheet';
import { MasteryProgressBar } from '../components/MasteryProgressBar';
import { MasteryHero } from '../components/MasteryHero';
import { StudySuggestionCard } from '../components/StudySuggestionCard';
import { SparklesIcon, DocumentIcon, ScanIcon, ChevronRightIcon, ChevronDownIcon, MoreVerticalIcon } from '../components/Icons';
import { SubjectItem, FocusArea, MasteryDetail } from '../types';
import {
  listMaterials,
  uploadMaterial,
  deleteMaterial,
  generateSummary,
  getSubjectMastery,
  MaterialAPI,
  SummaryAPI,
} from '../api/client';
import { addMemoryEntry, loadSubjectMemory, MemoryEntry, MemoryEntryType } from '../storage/subjectMemory';
import { clearChatThread } from '../storage/chatThread';
import { getCachedSummary, setCachedSummary, clearCachedSummary } from '../storage/summaryCache';

// Stable signature of the current mastery state. The AI suggestion card caches
// against it and only re-fetches when mastery actually changes (quota-safe).
function masterySignatureOf(d: MasteryDetail): string {
  return `o${Math.round(d.overall ?? 0)}|` + d.byTopic.map((t) => `${t.topic}:${Math.round(t.mastery)}`).join('|');
}

// Workspace chat launcher prefs (passed straight through to the embedded
// ChatScreen). Kept local so the workspace component is self-describing.
interface WorkspaceQuizPrefs {
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number | null;
}
interface WorkspaceCardsPrefs {
  cardCount: number;
  focus: 'definitions' | 'concepts' | 'qa';
}

interface SubjectWorkspaceScreenProps {
  subject: SubjectItem;
  onBack: () => void;
  onProfile: () => void;
  // ▾ menu: "Switch subject" → jump to the subjects list.
  onSwitchSubject: () => void;
  hideLeft?: boolean;
  initialPrompt?: string;
  // Embedded chat launcher cards (Quiz / Cards) — wired by App to navigate to
  // the quiz / flashcards surfaces, same as the old standalone Chat tab.
  onStartQuiz: (prefs: WorkspaceQuizPrefs) => void;
  onStartCards: (prefs: WorkspaceCardsPrefs) => void;
  // Quick-action "Quiz" pill → dedicated quiz setup flow.
  onOpenQuizSetup: () => void;
  // Subject actions surfaced from the ▾ workspace menu (rename / delete).
  onRenameSubject: (id: number, name: string) => void;
  onDeleteSubject: (id: number) => void;
  // Chat sheet open-state is owned by App (like the subject picker) so the global
  // back handlers close the sheet *instead of* navigating out of the workspace.
  chatOpen: boolean;
  onOpenChat: () => void;
  onCloseChat: () => void;
}

// --- Overview helpers (reused from SubjectDetailScreen; see that file) --------

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

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The Subject Workspace (2026-08-30 merge): one surface per subject where your
 * sources and your chat are the SAME place (NotebookLM model). Layout is tuned
 * for mid-screen phones (~434×928 dp, e.g. Huawei Nova 7i): the chat is the
 * dominant surface, and the overview is kept short and collapsible — Mastery is a
 * one-line hairline, Sources start collapsed, and Mastery-detail + Activity live
 * inside a collapsed "Insights" block (Activity capped at 5 rows) so they never
 * pile up the always-visible surface. The ▾ subject tile opens a workspace menu
 * (Switch / New chat / Manage sources / Rename / Delete) — it ACTS on the subject,
 * it never navigates back (that's Back's job). Removing the standalone Chat tab is
 * what makes this possible.
 */
export function SubjectWorkspaceScreen({
  subject,
  onBack,
  onProfile,
  onSwitchSubject,
  hideLeft,
  initialPrompt,
  onStartQuiz,
  onStartCards,
  onOpenQuizSetup,
  onRenameSubject,
  onDeleteSubject,
  chatOpen,
  onOpenChat,
  onCloseChat,
}: SubjectWorkspaceScreenProps) {
  const [materials, setMaterials] = useState<MaterialAPI[]>([]);
  const [summary, setSummary] = useState<SummaryAPI | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [cardsSetupVisible, setCardsSetupVisible] = useState(false);
  const [activity, setActivity] = useState<MemoryEntry[]>([]);
  const [masteryDetail, setMasteryDetail] = useState<MasteryDetail | null>(null);

  // Source selection (NotebookLM-style). The set of ACTIVE materials scopes the
  // embedded chat. Default = all active. Deselecting the last one reverts to all.
  const [activeIds, setActiveIds] = useState<number[]>([]);

  // ▾ workspace menu + rename sheet.
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState(subject.name);

  // Insights start OPEN now that the chat no longer competes for space — the
  // full mastery breakdown + activity feed can fill the scroll.
  const [insightsOpen, setInsightsOpen] = useState(true);

  // One-shot prompt seeded when "AI Summary" is tapped — opens the chat and asks
  // for a summary. Cleared whenever the sheet closes so a later FAB open (or
  // hardware/edge back) doesn't re-send it.
  const [chatSeed, setChatSeed] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!chatOpen) setChatSeed(undefined);
  }, [chatOpen]);

  // Drag-to-dismiss for the chat sheet: swipe the top grabber DOWN to minimize the
  // chat back to the FAB. Replaces the old ✕ button. Uses core PanResponder (no
  // reanimated). The sheet follows the finger a little, then either snaps back
  // (below threshold) or closes (past it).
  const dragY = useRef(new Animated.Value(0)).current;
  const chatPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 90) {
          onCloseChat();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (chatOpen) dragY.setValue(0);
  }, [chatOpen, dragY]);

  // Remount key for the embedded chat — bumping it clears the visible thread
  // (after clearChatThread wipes storage) for "New chat".
  const [chatNonce, setChatNonce] = useState(0);

  const subjectIdNum = parseInt(subject.id, 10);
  const scrollRef = useRef<ScrollView>(null);
  const [sourcesY, setSourcesY] = useState(0);

  useEffect(() => {
    if (subjectIdNum) {
      loadMaterials();
      loadActivity();
      loadMastery();
    }
  }, [subject.id]);

  // Keep activeIds in sync with the material set: first load → all active;
  // later uploads → preserve prior toggles + include new files; deleted files
  // drop out automatically.
  useEffect(() => {
    setActiveIds((prev) => {
      const current = materials.map((m) => m.id);
      if (prev.length === 0) return current;
      const kept = current.filter((id) => prev.includes(id));
      const added = current.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [materials]);

  const loadSummary = async (sourceCount: number) => {
    setIsLoadingSummary(true);
    try {
      const data = await generateSummary(subjectIdNum);
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
    try {
      const data = await listMaterials(subjectIdNum);
      setMaterials(data);
      setMaterialsError(null);
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
          (file as any).file
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
            : `"${file.name}" was saved, but could not be processed. Check the backend logs.`
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

  const handleToggle = (id: number) => {
    setActiveIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        // Never allow zero active sources — the chat always needs something to
        // ground on. Revert to the previous set (which still had this one).
        return next.length === 0 ? prev : next;
      }
      return [...prev, id];
    });
  };

  // ▾ menu actions ------------------------------------------------------------
  const handleNewChat = () => {
    clearChatThread(subjectIdNum).finally(() => setChatNonce((n) => n + 1));
  };

  const handleRename = () => {
    const next = renameText.trim();
    if (!next || next === subject.name) {
      setRenameVisible(false);
      return;
    }
    onRenameSubject(subjectIdNum, next);
    setRenameVisible(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete subject?',
      `This permanently removes "${subject.name}", its materials, and your chat history for it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteSubject(subjectIdNum),
        },
      ],
      { cancelable: true }
    );
  };

  const handleManageSources = () => {
    setMenuOpen(false);
    scrollRef.current?.scrollTo({ y: sourcesY, animated: true });
  };

  // Last-activity hint shown on the collapsed Insights header (avoids rendering
  // the whole feed up front).
  const lastActivityText =
    activity.length > 0 ? formatRelative(activity[0].timestamp) : null;

  return (
    <View style={styles.container}>
      <Header onBack={onBack} onProfile={onProfile} hideLeft={hideLeft} />

      {/* Back control only — the subject tile (the small "context box") was
          removed to free space; the big title below already shows the name.
          No ⋮ here: the menu trigger lives beside the title. */}
      <ScreenContextBar onBack={onBack} />

      {/* Overview — capped scroll; chat fills the rest below. */}
      <View style={styles.overviewWrap}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Big subject title row — name on the left, ⋯ menu trigger pinned
              right (opens the workspace menu: switch / new chat / rename /
              delete / manage sources). */}
          <View style={styles.titleRow}>
            <View style={styles.titleCol}>
              <Text style={styles.title}>{subject.name}</Text>
              <Text style={styles.lastStudiedMeta}>{subject.lastStudied || 'Ready for study session'}</Text>
            </View>
            <Pressable
              accessibilityLabel="Subject options"
              onPress={() => setMenuOpen(true)}
              style={({ pressed }) => [styles.titleMenuBtn, pressed && styles.titleMenuBtnPressed]}
            >
              <MoreVerticalIcon size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Mastery hairline — always-visible one-line glance (no big card). */}
          <View style={styles.masteryHairline}>
            {masteryDetail ? (
              <>
                <Text style={styles.masteryHairlineLabel}>Mastery</Text>
                <View style={styles.masteryHairlineTrack}>
                  <View style={[styles.masteryHairlineFill, { width: `${masteryDetail.overall ?? 0}%` }]} />
                </View>
                <Text style={styles.masteryHairlinePct}>{masteryDetail.overall}%</Text>
              </>
            ) : (
              <Text style={styles.masteryHairlineMuted}>Not yet assessed</Text>
            )}
          </View>

          {/* Quick Actions — Upload / Scan open the picker; Quiz → setup flow;
              Cards → setup sheet. "Explain" is dropped: chat is inline, just ask. */}
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
                accessibilityLabel="Generate quiz"
                onPress={onOpenQuizSetup}
                style={({ pressed }) => [styles.quickPill, pressed && styles.rowPressed]}
              >
                <SparklesIcon size={15} color={colors.brandGreen} />
                <Text style={styles.quickPillText}>Quiz</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Make flashcards"
                onPress={() => setCardsSetupVisible(true)}
                style={({ pressed }) => [styles.quickPill, pressed && styles.rowPressed]}
              >
                <SparklesIcon size={15} color={colors.brandGreen} />
                <Text style={styles.quickPillText}>Cards</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.divider} />

          {/* AI Summary tile — opens the chat sheet and seeds a summary ask. The
              chat owns the summary now (it's grounded on the active sources), so the
              tile no longer renders an inline summary. */}
          <Pressable
            onPress={() => {
              setChatSeed(`Summarize the key points from my notes for ${subject.name}.`);
              onOpenChat();
            }}
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

          <View style={styles.divider} />

          {/* Sources — now open by default: with the chat off the page, the
              full source list + active toggles can fill the space. */}
          <View
            onLayout={(e) => setSourcesY(e.nativeEvent.layout.y)}
          >
            <SourcesPanel subjectId={subjectIdNum} activeIds={activeIds} onToggle={handleToggle} />
          </View>

          <View style={styles.divider} />

          {/* Insights — open by default; holds the full mastery breakdown +
              (focus areas). Activity is now its own bounded section below. */}
          <Pressable
            accessibilityLabel={insightsOpen ? 'Collapse insights' : 'Expand insights'}
            onPress={() => setInsightsOpen((o) => !o)}
            style={({ pressed }) => [styles.insightsHeader, pressed && styles.rowPressed]}
          >
            <Text style={styles.sectionOverline}>
              INSIGHTS{lastActivityText ? `  ·  ${lastActivityText}` : ''}
            </Text>
            <View style={{ transform: [{ rotate: insightsOpen ? '0deg' : '-90deg' }] }}>
              <ChevronDownIcon size={16} color={colors.textMuted} />
            </View>
          </Pressable>
          {insightsOpen && (
            <View style={styles.insightsBody}>
              {/* Mastery detail + focus areas */}
              {masteryDetail ? (
                <View style={styles.masteryBlock}>
                  <MasteryHero
                    percentage={masteryDetail.overall ?? 0}
                    topicCount={masteryDetail.byTopic.length}
                    history={null}
                  />
                  {(() => {
                    const focusAreas = [...masteryDetail.byTopic]
                      .sort((a, b) => a.mastery - b.mastery);
                    if (focusAreas.length === 0) return null;
                    return (
                      <>
                        <Text style={[styles.focusOverline, { marginTop: 16 }]}>
                          FOCUS AREAS{`  ·  weakest first`}
                        </Text>
                        {focusAreas.map((fa: FocusArea) => (
                          <View key={fa.topic} style={styles.focusRow}>
                            <Text style={styles.focusTopic} numberOfLines={1}>{fa.topic}</Text>
                            <MasteryProgressBar percentage={fa.mastery} showText={false} width={80} />
                            <Text style={styles.focusPct}>{fa.mastery}%</Text>
                          </View>
                        ))}
                      </>
                    );
                  })()}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Not yet assessed</Text>
                  <Text style={styles.emptySubtitle}>
                    Take a quiz in this subject to see your real mastery and the topics to focus on.
                  </Text>
                </View>
              )}
              {/* AI suggestion — additive, slotted BELOW the mastery ring + focus
                  areas (both left untouched). Only re-fetches when the mastery
                  signature changes, so opening the workspace spends no AI quota. */}
              {masteryDetail?.assessed && (
                <StudySuggestionCard
                  subjectId={subjectIdNum}
                  signature={masterySignatureOf(masteryDetail)}
                />
              )}
            </View>
          )}

          {/* Activity — its OWN capped, scrollable section (pulled out from under
              the Insights toggle so it never piles up the page). The inner
              ScrollView bounds its height; the outer page scroll handles the rest. */}
          <View style={styles.activitySection}>
            <Text style={styles.sectionOverline}>
              ACTIVITY{lastActivityText ? `  ·  ${lastActivityText}` : ''}
            </Text>
            {activity.length > 0 ? (
              <ScrollView
                style={styles.activityScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.activityList}>
                  {activity.map((e) => (
                    <View key={e.id} style={styles.activityRow}>
                      <View style={styles.activityIconWrap}>
                        <Text style={styles.activityIcon}>{activityEmoji(e.type)}</Text>
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityText} numberOfLines={2}>{activityLabel(e)}</Text>
                        <Text style={styles.activityTime}>{formatRelative(e.timestamp)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptySubtitle}>
                  Uploads, quizzes, summaries, flashcards and chats in this subject will be remembered here.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Floating AI button — opens the chat as a full-height sheet. */}
      {!chatOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask AI"
          onPress={onOpenChat}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <SparklesIcon size={20} color="#FFFFFF" />
          <Text style={styles.fabLabel}>Ask AI</Text>
        </Pressable>
      )}

      {/* Chat sheet — full-height slide-up (Option A). The ✕ was removed; swipe the
          top grabber DOWN to minimize back to the FAB (hardware back also minimizes).
          `transparent` lets the subject details show behind as the sheet drags down. */}
      <Modal
        visible={chatOpen}
        animationType="slide"
        transparent
        onRequestClose={onCloseChat}
      >
        <Animated.View
          style={[styles.chatSheet, { transform: [{ translateY: dragY }] }]}
        >
          <View {...chatPanResponder.panHandlers} style={styles.chatGrabber}>
            <View style={styles.chatGrabberBar} />
          </View>
          <View style={styles.chatSheetHeader}>
            <Text style={styles.chatSheetTitle} numberOfLines={1}>{subject.name}</Text>
          </View>
          <View style={styles.chatSheetBody}>
            <ChatScreen
              key={`${chatNonce}:${chatSeed ?? 'manual'}`}
              embedded
              subjectId={subjectIdNum}
              subjectName={subject.name}
              materialIds={activeIds}
              initialPrompt={chatSeed ?? initialPrompt}
              onSwitchSubject={onSwitchSubject}
              onStartQuiz={onStartQuiz}
              onStartCards={onStartCards}
            />
          </View>
        </Animated.View>
      </Modal>

      {/* ▾ Workspace menu */}
      <ChatContextMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSwitchSubject={onSwitchSubject}
        onNewChat={handleNewChat}
        onManageSources={handleManageSources}
        onRename={() => {
          setMenuOpen(false);
          setRenameText(subject.name);
          setRenameVisible(true);
        }}
        onDelete={() => {
          setMenuOpen(false);
          handleDelete();
        }}
      />

      {/* Inline rename sheet */}
      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <View style={styles.renameOverlay}>
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Rename subject</Text>
            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Subject name"
              placeholderTextColor={colors.textPlaceholder}
              autoFocus
            />
            <View style={styles.renameActions}>
              <Pressable onPress={() => setRenameVisible(false)} style={({ pressed }) => [styles.renameBtn, pressed && styles.rowPressed]}>
                <Text style={styles.renameBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleRename} style={({ pressed }) => [styles.renameBtnPrimary, pressed && styles.rowPressed]}>
                <Text style={styles.renameBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CardsSetupSheet
        visible={cardsSetupVisible}
        subjectId={subjectIdNum}
        subjectName={subject.name}
        materials={materials}
        onClose={() => setCardsSetupVisible(false)}
        onStart={(prefs) => {
          setCardsSetupVisible(false);
          onStartCards(prefs);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  overviewWrap: {
    flex: 1,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 96 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6, marginBottom: 4 },
  titleCol: { flex: 1 },
  title: { fontFamily: typography.display, fontSize: 30, color: colors.textPrimary, marginBottom: 8, letterSpacing: -0.8 },
  lastStudiedMeta: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted, marginBottom: 16 },
  titleMenuBtn: {
    width: 40,
    height: 40,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: '#FFFFFF',
  },
  titleMenuBtnPressed: { backgroundColor: colors.surfaceMuted },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 12 },
  section: { paddingVertical: 4 },
  sectionOverline: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 14 },
  quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  quickPillText: { fontFamily: typography.sansMedium, fontSize: 13, color: colors.textPrimary },
  quickPillHighlight: { backgroundColor: colors.brandGreen, borderColor: colors.brandGreen },
  quickPillTextHighlight: { fontFamily: typography.sansSemiBold, fontSize: 13, color: colors.background },
  summaryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  summaryTileTitle: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.background },
  summaryTileSub: { fontFamily: typography.sansRegular, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  masteryBlock: {
    backgroundColor: '#F9F7F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 14,
  },
  masteryHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  masteryTitle: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.textPrimary },
  masteryPct: { fontFamily: typography.serifBold, fontSize: 26, color: colors.brandGreenDark },
  // Mastery hairline (always-visible glance) — compact, one line.
  masteryHairline: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  masteryHairlineLabel: { fontFamily: typography.sansMedium, fontSize: 13, color: colors.textPrimary },
  masteryHairlineTrack: { flex: 1, height: 6, backgroundColor: '#E5E7E2', borderRadius: 3, overflow: 'hidden' },
  masteryHairlineFill: { height: 6, backgroundColor: colors.brandGreen, borderRadius: 3 },
  masteryHairlinePct: { fontFamily: typography.sansSemiBold, fontSize: 13, color: colors.brandGreenDark, minWidth: 38, textAlign: 'right' },
  masteryHairlineMuted: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted },
  // Insights collapsible header/body.
  insightsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  insightsBody: { marginTop: 6 },
  focusOverline: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  focusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  focusTopic: { flex: 1, fontFamily: typography.sansMedium, fontSize: 13, color: colors.textPrimary, textTransform: 'capitalize' },
  focusPct: { fontFamily: typography.sansMedium, fontSize: 13, color: colors.textMuted, minWidth: 38, textAlign: 'right' },
  emptyCard: { padding: 20, alignItems: 'center', gap: 6 },
  emptyTitle: { fontFamily: typography.display, fontSize: 17, color: colors.textPrimary },
  emptySubtitle: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
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
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIcon: { fontSize: 18 },
  activityInfo: { flex: 1 },
  activityText: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.textPrimary, lineHeight: 19 },
  activityTime: { fontFamily: typography.sansRegular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  // Standalone, bounded Activity section (pulled out of the Insights toggle).
  activitySection: { marginTop: 8 },
  activityScroll: {
    maxHeight: 300,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  // Floating AI button — a pill centered just above the bottom-nav tab bar.
  fab: {
    position: 'absolute',
    bottom: 22,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 30,
    backgroundColor: colors.brandGreen,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  // Full-height chat sheet (Modal slide-up).
  chatSheet: { flex: 1, backgroundColor: colors.background },
  chatSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  chatSheetTitle: {
    flex: 1,
    fontFamily: typography.display,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.4,
    marginRight: 12,
  },
  // Drag handle at the top of the sheet — swipe it down to minimize. Pure affordance;
  // the PanResponder lives on this view.
  chatGrabber: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  chatGrabberBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderMedium,
  },
  chatSheetBody: { flex: 1 },
  rowPressed: { opacity: 0.75 },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  renameCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 14,
  },
  renameTitle: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.textPrimary },
  renameInput: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  renameActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  renameBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  renameBtnText: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.textPrimary },
  renameBtnPrimary: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.brandGreen },
  renameBtnPrimaryText: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.background },
});
