import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { colors, typography } from '../theme';
import { DocumentIcon, SparklesIcon, CloseIcon } from './Icons';
import { GuidedCapture, GuidedOutput, GuidedScope, SubjectItem } from '../types';

// ---------------------------------------------------------------------------
// GuidedCaptureThread — the smart study box's "mini chat thread" (Slice 4).
//
// Rendered when a NEW source is attached (its content_hash belongs to no
// subject yet). It asks ONE structured question at a time — name → scope →
// output (decision 5) — and renders a compact transcript of the answers so it
// reads like a conversation (decision 4). Answers are captured with structured
// inputs (a text field for the name, tappable chips for scope/output), NEVER
// per-turn LLM parsing (guard M2/S3): cheap, free-tier safe, injection-proof.
//
// This component is presentational. It owns only the in-progress text drafts;
// every committed answer and the async create/upload/handoff live in
// HomeScreen (with the durable guided state lifted to App — guard M1).
// ---------------------------------------------------------------------------

interface GuidedCaptureThreadProps {
  capture: GuidedCapture;
  subjects: SubjectItem[];
  busy: boolean;
  busyLabel: string;
  error: string | null;
  onAnswerName: (name: string) => void;
  onAnswerScope: (scope: GuidedScope, section: string | null) => void;
  onAnswerOutput: (output: GuidedOutput) => void;
  // Name collided with an existing subject and the user chose to add to it.
  onReuseExisting: (subject: SubjectItem) => void;
  onRetry: () => void;
  onCancel: () => void;
}

const OUTPUT_OPTIONS: { value: GuidedOutput; label: string; hint: string }[] = [
  { value: 'guide', label: 'Study guide', hint: 'A structured overview' },
  { value: 'quiz', label: 'Quiz', hint: 'Test myself on it' },
  { value: 'flashcards', label: 'Flashcards', hint: 'Term / definition cards' },
  { value: 'chat', label: 'Just chat', hint: 'Ask questions about it' },
];

export function GuidedCaptureThread({
  capture,
  subjects,
  busy,
  busyLabel,
  error,
  onAnswerName,
  onAnswerScope,
  onAnswerOutput,
  onReuseExisting,
  onRetry,
  onCancel,
}: GuidedCaptureThreadProps) {
  const [nameDraft, setNameDraft] = useState(capture.suggestedName);
  const [sectionDraft, setSectionDraft] = useState('');
  const [scopeSelection, setScopeSelection] = useState<GuidedScope | null>(null);
  // Set when the typed name matches an existing subject (guard M3).
  const [collision, setCollision] = useState<SubjectItem | null>(null);

  // Re-seed the name draft whenever we (re-)enter the name stage, so a
  // collision-rename or a remount starts from the best known value.
  useEffect(() => {
    if (capture.stage === 'name') {
      setNameDraft(capture.name ?? capture.suggestedName);
      setCollision(null);
    }
  }, [capture.stage]);

  const handleNameContinue = () => {
    const name = nameDraft.trim();
    if (!name) return;
    // Guard M3: name-collision check → reuse vs rename.
    const hit = subjects.find((s) => s.name.trim().toLowerCase() === name.toLowerCase());
    if (hit) {
      setCollision(hit);
      return;
    }
    onAnswerName(name);
  };

  const handleScopeContinue = () => {
    if (!scopeSelection) return;
    if (scopeSelection === 'section') {
      const section = sectionDraft.trim();
      if (!section) return;
      onAnswerScope('section', section);
    } else {
      onAnswerScope('whole', null);
    }
  };

  // Transcript lines for already-answered turns (conversational feel).
  const answered: { q: string; a: string }[] = [];
  if (capture.name) {
    answered.push({ q: 'What should I call this subject?', a: capture.name });
  }
  if (capture.scope) {
    answered.push({
      q: 'Study the whole document or just a section?',
      a: capture.scope === 'section' ? `Just the section on “${capture.section}”` : 'The whole document',
    });
  }

  return (
    <View style={styles.thread}>
      <View style={styles.threadHeader}>
        <View style={styles.threadFileChip}>
          <DocumentIcon size={16} color={colors.brandGreen} />
          <Text style={styles.threadFileName} numberOfLines={1}>
            {capture.file.name}
          </Text>
        </View>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.threadCancel}>
          <CloseIcon size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Transcript of answered turns */}
      {answered.map((turn, i) => (
        <View key={i} style={styles.turnBlock}>
          <View style={styles.aiRow}>
            <SparklesIcon size={14} color={colors.brandGreen} />
            <Text style={styles.aiText}>{turn.q}</Text>
          </View>
          <View style={styles.userBubble}>
            <Text style={styles.userBubbleText}>{turn.a}</Text>
          </View>
        </View>
      ))}

      {/* Finalizing state (create + upload in flight) */}
      {busy && (
        <View style={styles.busyBlock}>
          <ActivityIndicator size="small" color={colors.brandGreen} />
          <Text style={styles.busyText}>{busyLabel || 'Setting up your subject…'}</Text>
        </View>
      )}

      {/* Error state with retry (guard M5) */}
      {!busy && error && (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRetry} style={({ pressed }) => [styles.retryBtn, pressed && styles.btnPressed]}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {/* Active question */}
      {!busy && !error && capture.stage === 'name' && (
        <View style={styles.activeBlock}>
          <View style={styles.aiRow}>
            <SparklesIcon size={14} color={colors.brandGreen} />
            <Text style={styles.aiText}>What should I call this subject?</Text>
          </View>

          {collision ? (
            <View style={styles.collisionBox}>
              <Text style={styles.collisionText}>
                You already have a subject named “{collision.name}”. Add this file to it, or pick a
                different name.
              </Text>
              <View style={styles.collisionActions}>
                <Pressable
                  onPress={() => onReuseExisting(collision)}
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.primaryBtnText}>Add to “{collision.name}”</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCollision(null)}
                  style={({ pressed }) => [styles.ghostBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.ghostBtnText}>Use a different name</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="e.g. Neuro Week 3"
                placeholderTextColor={colors.textPlaceholder}
                style={styles.textInput}
                onSubmitEditing={handleNameContinue}
                returnKeyType="done"
              />
              <Pressable
                onPress={handleNameContinue}
                disabled={!nameDraft.trim()}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  !nameDraft.trim() && styles.btnDisabled,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {!busy && !error && capture.stage === 'scope' && (
        <View style={styles.activeBlock}>
          <View style={styles.aiRow}>
            <SparklesIcon size={14} color={colors.brandGreen} />
            <Text style={styles.aiText}>Study the whole document or just a section?</Text>
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setScopeSelection('whole')}
              style={({ pressed }) => [
                styles.chip,
                scopeSelection === 'whole' && styles.chipActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={[styles.chipText, scopeSelection === 'whole' && styles.chipTextActive]}>
                Whole document
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setScopeSelection('section')}
              style={({ pressed }) => [
                styles.chip,
                scopeSelection === 'section' && styles.chipActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={[styles.chipText, scopeSelection === 'section' && styles.chipTextActive]}>
                Just a section
              </Text>
            </Pressable>
          </View>
          {scopeSelection === 'section' && (
            <TextInput
              value={sectionDraft}
              onChangeText={setSectionDraft}
              placeholder="Which section? e.g. Chapter 4 — Synapses"
              placeholderTextColor={colors.textPlaceholder}
              style={styles.textInput}
              onSubmitEditing={handleScopeContinue}
              returnKeyType="done"
            />
          )}
          <Pressable
            onPress={handleScopeContinue}
            disabled={!scopeSelection || (scopeSelection === 'section' && !sectionDraft.trim())}
            style={({ pressed }) => [
              styles.primaryBtn,
              (!scopeSelection || (scopeSelection === 'section' && !sectionDraft.trim())) && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>
      )}

      {!busy && !error && capture.stage === 'output' && (
        <View style={styles.activeBlock}>
          <View style={styles.aiRow}>
            <SparklesIcon size={14} color={colors.brandGreen} />
            <Text style={styles.aiText}>How do you want to start studying it?</Text>
          </View>
          <View style={styles.outputList}>
            {OUTPUT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => onAnswerOutput(opt.value)}
                style={({ pressed }) => [styles.outputCard, pressed && styles.btnPressed]}
              >
                <Text style={styles.outputLabel}>{opt.label}</Text>
                <Text style={styles.outputHint}>{opt.hint}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  threadFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sageBadge,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
    marginRight: 8,
  },
  threadFileName: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.sageBadgeText,
    flex: 1,
  },
  threadCancel: {
    padding: 2,
  },
  turnBlock: {
    marginBottom: 10,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  aiText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brandGreenSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '85%',
  },
  userBubbleText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.brandGreenDark,
  },
  activeBlock: {
    marginTop: 2,
  },
  textInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.brandGreen,
    borderColor: colors.brandGreen,
  },
  chipText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.surface,
  },
  outputList: {
    gap: 8,
  },
  outputCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors.surfaceElevated,
  },
  outputLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  outputHint: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  primaryBtn: {
    backgroundColor: colors.brandGreen,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.surface,
  },
  ghostBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  ghostBtnText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnPressed: {
    opacity: 0.85,
  },
  collisionBox: {
    backgroundColor: '#FBF3E4',
    borderWidth: 1,
    borderColor: '#EBD9B4',
    borderRadius: 14,
    padding: 12,
  },
  collisionText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: '#6B5A2E',
    marginBottom: 10,
  },
  collisionActions: {
    gap: 4,
  },
  busyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  busyText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  errorBlock: {
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.errorText,
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  retryBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: colors.surface,
  },
});
