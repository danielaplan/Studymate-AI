import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { PaperclipIcon, DocumentIcon, CloseIcon, ChevronRightIcon, FolderIcon, ClockIcon, SparklesIcon } from '../components/Icons';
import { QuickActionPill } from '../components/QuickActionPill';
import { MasteryProgressBar } from '../components/MasteryProgressBar';
import { SubjectItem, QuizAttempt, GuidedCapture, GuidedFile, GuidedOutput, GuidedScope } from '../types';
import { loadQuizHistory } from '../storage/quizHistory';
import { addMemoryEntry } from '../storage/subjectMemory';
import { listSubjects, createSubject, uploadMaterial, searchSource, fileReuseCheck, SubjectAPI, FileReuseCheckResult } from '../api/client';
import { buildSuggestions } from '../utils/intent';
import { GuidedCaptureThread } from '../components/GuidedCaptureThread';

interface HomeScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onSelectPrompt: (prompt: string) => void;
  onSelectSubject: (subject: SubjectItem) => void;
  onOpenQuizResult: (attempt: QuizAttempt) => void;
  // Smart study box (Slice 4): hand off to grounded chat in a matched subject.
  onOpenChatWithSubject?: (subject: SubjectItem, prompt: string) => void;
  // Optional direct-to-quiz deep link. When provided by the router, the pulse's
  // "Study {subject}" action jumps straight into that subject's quiz; otherwise it
  // safely falls back to onSelectSubject (open the subject workspace).
  onStartQuiz?: (subject: SubjectItem) => void;
  // Guided create-subject thread (Slice 4 remainder). Durable capture state is
  // lifted to App (guard M1) so in-progress answers survive Home unmounting.
  guided?: GuidedCapture | null;
  onGuidedChange?: (capture: GuidedCapture | null) => void;
}

function quizBand(pct: number): string {
  if (pct >= 80) return colors.brandGreen;
  // Route the mid/low bands through the canonical status tokens (§17 retired
  // these exact bright hex from QuizOverview). Keeps the study-pulse quiet and
  // consistent with the rest of the system instead of a louder custom red/amber.
  if (pct >= 50) return colors.warning;
  return colors.error;
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

// Derives a readable subject name from a filename (strip extension, swap
// _/- for spaces, title-case). Used as the guided name field's default so the
// flow never burns an AI call just to pre-fill an editable text input (M2).
function cleanFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return 'Study Notes';
  return base
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Composes the chat prompt handed off after the guided flow finishes (decision
// 6: pre-fill, you send). Shaped by the scope + output answers (decision 5).
// Per Slice 3 / decision C the guided flow ALWAYS hands off to grounded Chat —
// even quiz/flashcard outputs become a chat prompt, never a dedicated screen.
function composeGuidedPrompt(c: GuidedCapture): string {
  const name = c.name || 'this subject';
  const section = c.scope === 'section' && c.section ? c.section.trim() : null;
  switch (c.output) {
    case 'guide':
      return section
        ? `Create a study guide for the section on ${section} in my ${name} notes.`
        : `Create a study guide for my ${name} notes.`;
    case 'quiz':
      return section
        ? `Quiz me on the section on ${section} in my ${name} notes.`
        : `Quiz me on my ${name} notes.`;
    case 'flashcards':
      return section
        ? `Make flashcards for the section on ${section} in my ${name} notes.`
        : `Make flashcards for my ${name} notes.`;
    case 'chat':
    default:
      return section
        ? `Explain the section on ${section} from my ${name} notes.`
        : `I've uploaded my ${name} notes. Give me an overview to get started.`;
  }
}

// Derives the study-pulse: a single headline plus the subject the student should
// act on next (if any). Uses only data HomeScreen already has (overall mastery per
// subject — no extra fetches). Priority: (1) unassessed subject -> first quiz,
// (2) weakest assessed subject below threshold -> focus there, (3) all healthy ->
// encouragement, (4) no subjects -> neutral prompt.
interface PulseResult {
  headline: string;
  focus: SubjectItem | null;
}
function buildPulse(items: SubjectItem[]): PulseResult {
  if (items.length === 0) {
    return { headline: 'Add a subject and take a quiz to see your study pulse.', focus: null };
  }
  const unassessed = items.find((s) => s.mastery == null);
  if (unassessed) {
    return { headline: `Take your first quiz in ${unassessed.name} to measure mastery.`, focus: unassessed };
  }
  const assessed = items.filter((s) => s.mastery != null) as Array<SubjectItem & { mastery: number }>;
  const weakest = assessed.reduce(
    (min, s) => ((s.mastery as number) < (min.mastery as number) ? s : min),
    assessed[0]
  );
  if (weakest.mastery < 60) {
    return { headline: `Focus on ${weakest.name} — your weakest subject (${weakest.mastery}%).`, focus: weakest };
  }
  const avg = Math.round(assessed.reduce((sum, s) => sum + (s.mastery as number), 0) / assessed.length);
  return { headline: `Strong progress — ${avg}% average mastery across ${assessed.length} subjects.`, focus: null };
}

// Local-day key (YYYY-MM-DD) so activity buckets by the user's calendar day, not UTC.
function localDayKey(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Fallback subject pick when the global source-match finds no confident match
// (fix #15, user request: "whatever I ask it will make use of that unless there
// is no upload at all"). As long as the library is non-empty, the request must
// land in SOME subject's chat — never a dead-end notice. Best effort: rank
// subjects by word-overlap between the prompt and the subject name (same idea
// as buildSuggestions); if nothing overlaps, use the first subject.
function pickFallbackSubject(prompt: string, subjects: SubjectItem[]): SubjectItem {
  const words = prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  let best = subjects[0];
  let bestScore = 0;
  for (const s of subjects) {
    const name = s.name.toLowerCase();
    const score = words.reduce((acc, w) => (name.includes(w) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

// Lightweight placeholder rows shown while the initial subject load is in flight,
// so the screen doesn't flash empty states before data arrives.
function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeletonRow} />
      ))}
    </View>
  );
}

export function HomeScreen({
  onOpenMenu,
  onOpenProfile,
  onSelectPrompt,
  onSelectSubject,
  onOpenQuizResult,
  onOpenChatWithSubject,
  onStartQuiz,
  guided,
  onGuidedChange,
}: HomeScreenProps) {
  const [inputPrompt, setInputPrompt] = useState('');
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const [subjectsLoadFailed, setSubjectsLoadFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  // Smart study box: while the global source-match is in flight.
  const [isMatching, setIsMatching] = useState(false);
  // Inline notice shown under the box when no uploaded source matches the
  // question (Slice 2). Cleared as soon as the user edits their text.
  const [noSourceNotice, setNoSourceNotice] = useState<string | null>(null);

  // Modal to choose subject if multiple exist when uploading from Home
  const [pendingFile, setPendingFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  // content_hash of the pending file from the cheap reuse check (guard E/K).
  // Empty string if the check failed/was skipped (treated as a new file).
  const [pendingFileHash, setPendingFileHash] = useState('');
  const [showSubjectPickerModal, setShowSubjectPickerModal] = useState(false);
  // Shown after a file is picked (when subjects exist) to decide: new subject vs existing.
  const [showUploadTargetModal, setShowUploadTargetModal] = useState(false);
  // Expands the Recent quizzes list beyond its capped preview.
  const [showAllQuizzes, setShowAllQuizzes] = useState(false);

  // --- Guided create-subject thread (Slice 4 remainder) ---
  // The durable capture state (answers collected so far) is LIFTED to App
  // (guard M1): HomeScreen unmounts on every navigation, and the in-progress
  // answers must survive the user wandering off mid-flow. Only transient UI
  // state (busy spinner, error banner) lives here.
  const [guidedBusy, setGuidedBusy] = useState(false);
  const [guidedBusyLabel, setGuidedBusyLabel] = useState('');
  const [guidedError, setGuidedError] = useState<string | null>(null);
  // If the final create step made a subject but the upload failed, remember it
  // so retry re-uploads into the SAME subject instead of creating a duplicate.
  const guidedCreatedSubject = useRef<{ id: number; name: string } | null>(null);
  // Which guided operation failed, so "Try again" retries the RIGHT one:
  // 'create' = create-new-subject path; 'reuse' = add-to-existing (collision).
  const guidedRetryAction = useRef<'create' | 'reuse' | null>(null);
  const guidedReuseTarget = useRef<SubjectItem | null>(null);

  useEffect(() => {
    loadSubjects();
  }, []);

  // The upload "Choose Subject" / target modals only close via their ✕ (and
  // Android hardware back). On web there's no hardware back, so listen for Esc so
  // the subpicker always has a keyboard escape (the ▾ menu is for acting on a
  // subject, never for leaving — that's Back's job).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!showSubjectPickerModal && !showUploadTargetModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSubjectPickerModal(false);
        setShowUploadTargetModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSubjectPickerModal, showUploadTargetModal]);

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

        // No subjects yet -> nothing to reuse, so go straight into the guided
        // create-subject thread (guard C). Skip the reuse check (it could only
        // say "unknown" against an empty library).
        if (subjects.length === 0) {
          startGuidedCapture(file, '');
          return;
        }

        // Library is non-empty -> run the CHEAP reuse check first (guard E/K,
        // decision 7). No AI call, no writes. A known file jumps straight to its
        // subject's chat (skip naming); an unknown file proceeds to the
        // new-vs-existing chooser.
        setIsUploading(true);
        setUploadStatus('Checking your library…');
        let reuse: FileReuseCheckResult | null = null;
        try {
          reuse = await fileReuseCheck(
            file.uri,
            file.name,
            file.mimeType || 'application/pdf',
            (file as any).file
          );
        } catch {
          reuse = null; // check failed -> treat as a new file, never block
        }
        setIsUploading(false);
        setUploadStatus('');

        if (reuse && reuse.known && reuse.existing_subject_id != null && onOpenChatWithSubject) {
          // Guard K / decision 7: this exact file already lives in a subject.
          // Continue there instead of creating a duplicate.
          const existing =
            subjects.find((s) => s.id === String(reuse!.existing_subject_id)) ??
            ({
              id: String(reuse.existing_subject_id),
              name: reuse.existing_subject_name || 'that subject',
              materialsCount: 1,
              mastery: null,
            } as SubjectItem);
          onOpenChatWithSubject(existing, `Let's pick up where we left off with ${existing.name}.`);
          return;
        }

        // Unknown file -> existing new-vs-existing chooser. The "create new
        // subject" branch now launches the guided thread (see modal below).
        setPendingFile(file);
        setPendingFileHash(reuse ? reuse.content_hash : '');
        setShowUploadTargetModal(true);
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

  // --- Guided create-subject thread (Slice 4 remainder) ---
  // Entry (guard C): a NEW source is attached. The cheap reuse check already
  // ran in handlePickDocument; if the file is unknown we land here and walk the
  // name → scope → output thread (decision 5). Answers are structured inputs
  // (guard M2); the final create/upload gates on processing_status (M4/M5).

  const startGuidedCapture = (file: DocumentPicker.DocumentPickerAsset, hash: string) => {
    if (!onGuidedChange) return;
    guidedCreatedSubject.current = null;
    guidedRetryAction.current = null;
    guidedReuseTarget.current = null;
    setGuidedError(null);
    setGuidedBusy(false);
    setGuidedBusyLabel('');
    onGuidedChange({
      stage: 'name',
      file: {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        webFile: (file as any).file,
      },
      suggestedName: cleanFileName(file.name),
      name: null,
      scope: null,
      section: null,
      output: null,
      contentHash: hash,
    });
  };

  const handleGuidedName = (name: string) => {
    if (!guided || !onGuidedChange) return;
    onGuidedChange({ ...guided, name, stage: 'scope' });
  };

  const handleGuidedScope = (scope: GuidedScope, section: string | null) => {
    if (!guided || !onGuidedChange) return;
    onGuidedChange({ ...guided, scope, section, stage: 'output' });
  };

  const handleGuidedOutput = (output: GuidedOutput) => {
    if (!guided || !onGuidedChange) return;
    const next = { ...guided, output };
    onGuidedChange(next);
    finalizeGuided(next);
  };

  // Name collided with an existing subject and the user chose to add to it
  // (guard M3 reuse branch). Uploads the file into that subject and hands off
  // to its chat — no new subject is created.
  const handleGuidedReuseExisting = async (subject: SubjectItem) => {
    if (!guided) return;
    guidedRetryAction.current = 'reuse';
    guidedReuseTarget.current = subject;
    setGuidedError(null);
    setGuidedBusy(true);
    setGuidedBusyLabel(`Adding to "${subject.name}"…`);
    try {
      const uploaded = await uploadMaterial(
        parseInt(subject.id, 10),
        guided.file.uri,
        guided.file.name,
        guided.file.mimeType || 'application/pdf',
        guided.file.webFile as Blob | undefined
      );
      // Guard M4/M5: only hand off once indexing actually finished; surface a
      // failed read distinctly from a still-indexing file.
      if (uploaded.processing_status === 'failed') {
        throw new Error('We couldn\'t read that file. It may be corrupted or password-protected.');
      }
      if (uploaded.processing_status !== 'done') {
        throw new Error('The file was added but is still being indexed. Try again in a moment.');
      }
      await addMemoryEntry({
        type: 'upload',
        subjectId: parseInt(subject.id, 10),
        timestamp: new Date().toISOString(),
        fileName: guided.file.name,
      });
      await loadSubjects();
      const prompt = composeGuidedPrompt({ ...guided, name: subject.name });
      finishGuided(subject, prompt);
    } catch (err: any) {
      setGuidedBusy(false);
      setGuidedBusyLabel('');
      setGuidedError(err.message || 'Could not add the file to that subject.');
    }
  };

  // Create the subject (if not already created on a prior failed attempt),
  // upload the file, gate on processing_status (M4/M5), then hand off to chat.
  const finalizeGuided = async (capture: GuidedCapture) => {
    const name = capture.name || cleanFileName(capture.file.name);
    guidedRetryAction.current = 'create';
    setGuidedError(null);
    setGuidedBusy(true);
    try {
      // Idempotent create (guard E): if a previous attempt already made the
      // subject, reuse it instead of creating a duplicate.
      let subject = guidedCreatedSubject.current;
      if (!subject) {
        setGuidedBusyLabel(`Creating "${name}"…`);
        const created = await createSubject(name);
        subject = { id: created.id, name: created.name };
        guidedCreatedSubject.current = subject;
      }

      setGuidedBusyLabel('Indexing your source…');
      const uploaded = await uploadMaterial(
        subject.id,
        capture.file.uri,
        capture.file.name,
        capture.file.mimeType || 'application/pdf',
        capture.file.webFile as Blob | undefined
      );

      // Guard M4/M5: hand off only when indexing finished; surface failure with
      // a retry (retry re-uploads into the SAME subject via guidedCreatedSubject).
      if (uploaded.processing_status === 'failed') {
        throw new Error('We couldn\'t read that file. It may be corrupted or password-protected.');
      }
      if (uploaded.processing_status !== 'done') {
        throw new Error('Your source is still being indexed. Try again in a moment.');
      }

      await addMemoryEntry({
        type: 'upload',
        subjectId: subject.id,
        timestamp: new Date().toISOString(),
        fileName: capture.file.name,
      });
      await loadSubjects();

      const prompt = composeGuidedPrompt(capture);
      finishGuided({ id: String(subject.id), name: subject.name, materialsCount: 1, mastery: null }, prompt);
    } catch (err: any) {
      setGuidedBusy(false);
      setGuidedBusyLabel('');
      setGuidedError(err.message || 'Something went wrong while setting up your subject.');
    }
  };

  // Shared success path: clear the capture, refresh, and hand off to grounded
  // chat with the composed prompt (decision 6 / guard C → always Chat).
  const finishGuided = (subject: SubjectItem, prompt: string) => {
    setGuidedBusy(false);
    setGuidedBusyLabel('');
    setGuidedError(null);
    guidedCreatedSubject.current = null;
    guidedRetryAction.current = null;
    guidedReuseTarget.current = null;
    if (onGuidedChange) onGuidedChange(null);
    if (onOpenChatWithSubject) {
      onOpenChatWithSubject(subject, prompt);
    } else {
      onSelectSubject(subject);
    }
  };

  const handleGuidedRetry = () => {
    if (!guided) return;
    // Retry the operation that actually failed: adding to an existing subject
    // (collision branch) vs creating a new one. Never blindly re-create.
    if (guidedRetryAction.current === 'reuse' && guidedReuseTarget.current) {
      handleGuidedReuseExisting(guidedReuseTarget.current);
    } else {
      finalizeGuided(guided);
    }
  };

  const handleGuidedCancel = () => {
    setGuidedBusy(false);
    setGuidedBusyLabel('');
    setGuidedError(null);
    guidedCreatedSubject.current = null;
    guidedRetryAction.current = null;
    guidedReuseTarget.current = null;
    if (onGuidedChange) onGuidedChange(null);
  };

  // Smart study box (Slice 4): on submit, ask the backend which subject the
  // question is about (global RAG match). A confident match hands off to that
  // subject's grounded chat (decisions 1/2/3/6/7); no match or any error falls
  // back to the existing intent router (Slice 2 fallback).
  // Single owner of "submit a prompt from the Home box" — used by BOTH the Go
  // button and the suggestion chips (fix 2026-08-28: chips used to take the old
  // direct route to dedicated screens, bypassing the chat hub / decision 1).
  // Returns true when the prompt was consumed (routed to chat or fallback).
  const submitPromptText = async (prompt: string): Promise<boolean> => {
    if (!prompt || isMatching) return false;

    // Nothing uploaded yet -> nothing to ground in. Gate with guidance shown
    // INLINE under the box (decision 1) — same place as the no-match notice,
    // never a popup. Applies to every prompt type (quiz / flashcards / chat):
    // all of them need a source to ground in. Keep the typed text so the user
    // can hit go again right after uploading.
    if (subjects.length === 0) {
      setNoSourceNotice(
        'Upload a source first — attach your notes with the paperclip so I can ' +
          'ground my answers in them. Then send this again.'
      );
      return false;
    }

    setIsMatching(true);
    setNoSourceNotice(null);
    try {
      const match = await searchSource(prompt);
      if (match.matched && match.subject_id != null && onOpenChatWithSubject) {
        const target = subjects.find((s) => s.id === String(match.subject_id));
        if (target) {
          onOpenChatWithSubject(target, prompt);
          return true;
        }
      }
      // No confident content match, but the library is NOT empty -> never
      // dead-end (fix #15): fall back to the best name-matching subject and
      // open ITS chat. The chat hub handles the request there (grounded RAG
      // will answer from that subject's notes, or say what it can't find).
      if (onOpenChatWithSubject) {
        onOpenChatWithSubject(pickFallbackSubject(prompt, subjects), prompt);
        return true;
      }
      setNoSourceNotice(
        'No source in your library matches this. Attach the relevant notes with ' +
          'the paperclip, or rephrase — answers come strictly from your uploaded materials.'
      );
      return false;
    } catch {
      // Backend unreachable -> degrade to the old behavior, never block.
      onSelectPrompt(prompt);
      return true;
    } finally {
      setIsMatching(false);
    }
  };

  const handleSubmit = async () => {
    const prompt = inputPrompt.trim();
    if (!prompt) return;
    const consumed = await submitPromptText(prompt);
    // Keep the typed text on no-match so the user can rephrase (Slice 2).
    if (consumed) setInputPrompt('');
  };

  // Live suggestion chips derived from what's being typed + the user's subjects.
  const suggestionChips = useMemo(
    () => buildSuggestions(inputPrompt, subjects),
    [inputPrompt, subjects]
  );

  // Suggestion chips go through the SAME smart path as the Go button (fix
  // 2026-08-28): match the subject → open ITS chat (the hub), never the old
  // direct jump to quiz/summary/flashcards screens. Only clear the box when
  // the prompt was actually consumed.
  const handlePickSuggestion = async (suggestion: string) => {
    const consumed = await submitPromptText(suggestion);
    if (consumed) setInputPrompt('');
  };

  const hasSubjects = subjects.length > 0;

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

  // "Continue Studying" should reflect real recent activity, not just the first
  // subject in the list. Use the most recent quiz attempt whose subject still
  // exists (visibleHistory is already filtered to existing subjects).
  const lastAttempt = visibleHistory.reduce<QuizAttempt | null>(
    (latest, a) => (latest == null || (a.createdAt && a.createdAt >= latest.createdAt) ? a : latest),
    null
  );
  const continueSubjectId = lastAttempt?.subjectId != null ? String(lastAttempt.subjectId) : null;
  const continueSubject = hasSubjects
    ? continueSubjectId
      ? subjects.find((s) => s.id === continueSubjectId) ?? subjects[0]
      : subjects[0]
    : null;

  // Presentation precedence for the subject/quiz areas: error > initial-loading > content.
  const showLoadError = subjectsLoadFailed && subjects.length === 0;
  const isInitialLoading = isLoading && subjects.length === 0 && !subjectsLoadFailed;

  // Personalized study-pulse: headline + focus subject, derived from loaded subjects.
  const pulse = useMemo(() => buildPulse(subjects), [subjects]);

  // 14-day activity heatmap from quiz history (bucketed by local day; cell tinted
  // by that day's average score via the shared quiz-band tokens).
  const heatmap = useMemo(() => {
    const today = new Date();
    const days: Array<{ date: string; pct: number | null }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = localDayKey(d.toISOString());
      const dayAttempts = visibleHistory.filter((a) => localDayKey(a.createdAt) === key);
      const pct = dayAttempts.length
        ? Math.round(dayAttempts.reduce((sum, a) => sum + a.pct, 0) / dayAttempts.length)
        : null;
      days.push({ date: key, pct });
    }
    return days;
  }, [visibleHistory]);

  // Current streak: consecutive active days ending today (an empty today doesn't
  // break the streak — it just hasn't happened yet).
  const streak = useMemo(() => {
    const active = heatmap.map((h) => h.pct != null);
    let end = active.length - 1;
    if (end >= 0 && !active[end]) end -= 1;
    let count = 0;
    for (let i = end; i >= 0; i--) {
      if (active[i]) count += 1;
      else break;
    }
    return count;
  }, [heatmap]);

  // Trend: last-3 attempts vs prior-3 (history is newest-first).
  const trend = useMemo<'up' | 'down' | 'flat'>(() => {
    if (visibleHistory.length < 6) return 'flat';
    const avg = (slice: QuizAttempt[]) => slice.reduce((s, a) => s + a.pct, 0) / slice.length;
    const last3 = avg(visibleHistory.slice(0, 3));
    const prev3 = avg(visibleHistory.slice(3, 6));
    if (last3 - prev3 >= 5) return 'up';
    if (prev3 - last3 >= 5) return 'down';
    return 'flat';
  }, [visibleHistory]);

  // Local alias so TypeScript narrows the focus subject inside the JSX branch.
  const focus = pulse.focus;

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
              onChangeText={(text) => {
                setInputPrompt(text);
                if (noSourceNotice) setNoSourceNotice(null);
              }}
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

          {suggestionChips.length > 0 && (
            <View style={styles.suggestionList}>
              {suggestionChips.map((chip) => (
                <Pressable
                  key={chip}
                  onPress={() => handlePickSuggestion(chip)}
                  style={({ pressed }) => [
                    styles.suggestionCard,
                    pressed && styles.suggestionCardPressed,
                  ]}
                >
                  <SparklesIcon size={16} color={colors.brandGreen} />
                  <Text style={styles.suggestionCardText}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {isUploading && (
            <View style={styles.uploadProgressRow}>
              <ActivityIndicator size="small" color={colors.brandGreen} />
              <Text style={styles.uploadProgressText}>{uploadStatus || 'Processing file...'}</Text>
            </View>
          )}

          {isMatching && (
            <View style={styles.uploadProgressRow}>
              <ActivityIndicator size="small" color={colors.brandGreen} />
              <Text style={styles.uploadProgressText}>Finding the right subject…</Text>
            </View>
          )}

          {noSourceNotice && (
            <View style={styles.noSourceNotice}>
              <Text style={styles.noSourceNoticeText}>{noSourceNotice}</Text>
            </View>
          )}

          {/* Guided create-subject thread (Slice 4): expands under the box when
              a NEW source is attached. Asks name → scope → output, then creates
              the subject and hands off to grounded chat. */}
          {guided && onGuidedChange && (
            <GuidedCaptureThread
              capture={guided}
              subjects={subjects}
              busy={guidedBusy}
              busyLabel={guidedBusyLabel}
              error={guidedError}
              onAnswerName={handleGuidedName}
              onAnswerScope={handleGuidedScope}
              onAnswerOutput={handleGuidedOutput}
              onReuseExisting={handleGuidedReuseExisting}
              onRetry={handleGuidedRetry}
              onCancel={handleGuidedCancel}
            />
          )}

          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <Text style={styles.summaryEyebrow}>Study pulse</Text>
              <Text style={styles.summaryBadge}>
                {visibleHistory.length > 0 ? `Last ${visibleHistory[0].pct}%` : 'No quizzes yet'}
              </Text>
            </View>

            {/* 14-day activity heatmap — at-a-glance rhythm signal. */}
            <View
              style={styles.heatmapRow}
              accessibilityLabel={`Study activity, last 14 days${streak > 0 ? `, ${streak}-day streak` : ''}`}
            >
              {heatmap.map((h) => (
                <View
                  key={h.date}
                  style={[styles.heatCell, { backgroundColor: h.pct == null ? colors.borderLight : quizBand(h.pct) }]}
                />
              ))}
            </View>

            <Text style={styles.summaryHeadline}>{pulse.headline}</Text>

            {/* One-tap action loop: jump to the focus subject (quiz when wired,
                otherwise the subject workspace). No new routing required. */}
            {focus && (
              <Pressable
                accessibilityLabel={`Study ${focus.name}`}
                onPress={() => (onStartQuiz ? onStartQuiz(focus) : onSelectSubject(focus))}
                style={({ pressed }) => [styles.pulseAction, pressed && styles.pulseActionPressed]}
              >
                <Text style={styles.pulseActionText}>Study {focus.name}</Text>
              </Pressable>
            )}

            {/* Streak + trend — momentum, not just counts. */}
            <View style={styles.pulseMetaRow}>
              <Text style={styles.pulseMetaText}>{streak > 0 ? `${streak}-day streak` : 'No streak yet'}</Text>
              <Text style={styles.pulseMetaText}>
                {trend === 'up' ? 'Rising' : trend === 'down' ? 'Needs review' : 'Steady'}
              </Text>
            </View>

            <View style={styles.summaryMetrics}>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{totalNotes}</Text>
                <Text style={styles.metricLabel}>notes</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricValue}>{assessedSubjects.length ? `${avgMastery}%` : '—'}</Text>
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
              onPress={() => submitPromptText('Summarize my notes')}
            />
            <QuickActionPill
              label="Quiz me on my materials"
              onPress={() => submitPromptText('Quiz me on my materials')}
            />
          </View>
        </View>

        {showLoadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Couldn’t reach the server. Check your connection and try again.</Text>
            <Pressable
              onPress={loadSubjects}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.cardPressed]}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

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
          ) : isInitialLoading ? (
            <SkeletonList rows={1} />
          ) : showLoadError ? (
            <Pressable
              accessibilityLabel="Retry loading subjects"
              onPress={loadSubjects}
              style={({ pressed }) => [styles.emptyStateCard, pressed && styles.cardPressed]}
            >
              <View style={styles.emptyIconBadge}>
                <PaperclipIcon size={20} color={colors.brandGreen} />
              </View>
              <Text style={styles.emptyStateTitle}>Couldn’t load your subjects</Text>
              <Text style={styles.emptyStateSubtitle}>Tap to retry.</Text>
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
            <View>
            <View style={styles.subjectsList}>
              {subjects.slice(0, 5).map((sub) => (
                <Pressable
                  key={sub.id}
                  accessibilityLabel={`Open subject ${sub.name}`}
                  onPress={() => onSelectSubject(sub)}
                  style={({ pressed }) => [styles.subjectRow, pressed && styles.cardPressed]}
                >
                  <Text style={styles.subjectName} numberOfLines={2}>{sub.name}</Text>
                  <View style={styles.subjectMasteryWrap}>
                    <MasteryProgressBar percentage={sub.mastery} width={90} />
                  </View>
                </Pressable>
              ))}
            </View>
            {subjects.length > 5 && (
              <Pressable
                accessibilityLabel="View all subjects"
                onPress={onOpenMenu}
                style={({ pressed }) => [styles.viewAllRow, pressed && styles.cardPressed]}
              >
                <Text style={styles.viewAllText}>View all {subjects.length} subjects</Text>
                <ChevronRightIcon size={16} color={colors.textMuted} />
              </Pressable>
            )}
            </View>
          ) : isInitialLoading ? (
            <SkeletonList rows={3} />
          ) : showLoadError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Couldn’t load your subjects</Text>
              <Text style={styles.errorSubtitle}>
                The study backend is unreachable. Check your connection and try again.
              </Text>
              <Pressable
                accessibilityLabel="Retry loading subjects"
                onPress={loadSubjects}
                style={({ pressed }) => [styles.retryPill, pressed && styles.retryPillPressed]}
              >
                <Text style={styles.retryPillText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconBadge}>
                <FolderIcon size={20} color={colors.brandGreenDark} />
              </View>
              <Text style={styles.emptyStateTitle}>No subjects yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Subjects you create will appear here. Add your first one to start studying.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Recent quizzes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent quizzes</Text>
          {visibleHistory.length > 0 ? (
            <View>
            <View style={styles.quizHistoryList}>
              {(showAllQuizzes ? visibleHistory : visibleHistory.slice(0, 5)).map((attempt) => (
                <Pressable
                  key={attempt.id}
                  accessibilityLabel={`Open quiz result for ${attempt.subjectName}`}
                  onPress={() => onOpenQuizResult(attempt)}
                  style={({ pressed }) => [styles.quizHistoryRow, pressed && styles.cardPressed]}
                >
                  <View style={styles.quizTopRow}>
                    <View style={[styles.quizHistoryDot, { backgroundColor: quizBand(attempt.pct) }]} />
                    <Text style={styles.quizHistorySubject} numberOfLines={2}>{attempt.subjectName}</Text>
                  </View>
                  <View style={styles.quizBottomRow}>
                    <Text style={styles.quizHistoryMeta}>
                      {attempt.score}/{attempt.total} • {attempt.pct}%
                      {attempt.difficulty ? ` • ${attempt.difficulty}` : ''}
                    </Text>
                    <View style={styles.quizBottomRight}>
                      <Text style={styles.quizHistoryDate}>{formatAttemptDate(attempt.createdAt)}</Text>
                      <ChevronRightIcon size={16} color={colors.textMuted} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
            {visibleHistory.length > 5 && !showAllQuizzes && (
              <Pressable
                accessibilityLabel="Show all quizzes"
                onPress={() => setShowAllQuizzes(true)}
                style={({ pressed }) => [styles.viewAllRow, pressed && styles.cardPressed]}
              >
                <Text style={styles.viewAllText}>Show all {visibleHistory.length} quizzes</Text>
                <ChevronRightIcon size={16} color={colors.textMuted} />
              </Pressable>
            )}
            </View>
          ) : isInitialLoading ? (
            <SkeletonList rows={2} />
          ) : (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconBadge}>
                <ClockIcon size={20} color={colors.brandGreenDark} />
              </View>
              <Text style={styles.emptyStateTitle}>No quizzes yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Finished quizzes will show up here so you can track your progress.
              </Text>
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
                // Guided create-subject thread (Slice 4): name → scope → output,
                // then create + upload + hand off to grounded chat.
                if (pendingFile) startGuidedCapture(pendingFile, pendingFileHash);
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
  noSourceNotice: {
    marginTop: 10,
    backgroundColor: '#FBF3E4',
    borderWidth: 1,
    borderColor: '#EBD9B4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noSourceNoticeText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B5A2E',
  },
  suggestionList: {
    marginTop: 10,
    gap: 8,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  suggestionCardText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.sansRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
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
    shadowColor: colors.ink,
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
    shadowColor: colors.ink,
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
    backgroundColor: colors.surface,
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
  heatmapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 12,
  },
  heatCell: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  pulseAction: {
    marginTop: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.brandGreen,
    paddingHorizontal: 16,
  },
  pulseActionPressed: { opacity: 0.85 },
  pulseActionText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.surface,
  },
  pulseMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  pulseMetaText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 22,
    padding: 16,
    gap: 16,
    shadowColor: colors.ink,
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
    paddingVertical: 30,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 10,
  },
  emptyIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.sageBadge,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyStateTitle: {
    fontFamily: typography.serifSemiBold,
    fontSize: 17,
    color: colors.brandGreenDark,
    letterSpacing: -0.2,
  },
  emptyStateSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.1,
    paddingHorizontal: 6,
  },
  errorCard: {
    paddingVertical: 28,
    paddingHorizontal: 22,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontFamily: typography.serifSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 2,
  },
  errorSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.1,
    paddingHorizontal: 6,
  },
  retryPill: {
    marginTop: 6,
    height: 40,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: colors.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryPillPressed: {
    opacity: 0.85,
  },
  retryPillText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.surface,
  },
  subjectsList: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  subjectRow: {
    paddingVertical: 12,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  subjectName: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  subjectMasteryWrap: {
    marginTop: 8,
  },
  quizHistoryList: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  quizHistoryRow: {
    paddingVertical: 12,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  quizTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quizBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quizBottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quizHistoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  quizHistorySubject: {
    flex: 1,
    flexShrink: 1,
    fontFamily: typography.sansMedium,
    fontSize: 16,
    lineHeight: 21,
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
    backgroundColor: colors.surface,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 18,
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.error,
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  retryBtnText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.surface,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  viewAllText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.brandGreen,
  },
  skeletonList: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skeletonRow: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#EDEFEA',
    marginVertical: 6,
  },
});
