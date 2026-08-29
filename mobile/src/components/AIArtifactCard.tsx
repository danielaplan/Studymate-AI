import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Clipboard } from 'react-native';
import { colors, typography } from '../theme';
import { SparklesIcon, CopyIcon, BookmarkCheckIcon, RefreshIcon, ChevronRightIcon } from './Icons';

export type ArtifactType = 'summary' | 'quiz' | 'flashcards';

export interface ArtifactDetails {
  title: string;
  items: { term?: string; text: string }[];
}

interface AIArtifactCardProps {
  type: ArtifactType;
  leadText: string;
  bodyText: string;
  details?: ArtifactDetails;
  onCopy?: () => void;
  onSave?: () => void | Promise<unknown>;
  onRegenerate?: () => void | Promise<void>;
  // For quiz/flashcards: jump to the dedicated screen that holds the full content.
  onOpen?: () => void;
  onOpenLabel?: string;
  // Skeleton state shown while the AI response streams in (no layout shift).
  loading?: boolean;
}

const TAG_LABEL: Record<ArtifactType, string> = {
  summary: 'Summary',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
};

/**
 * Reusable study-artifact card for AI-generated summaries / quizzes / flashcards.
 * Distinct visual language from chat bubbles (see `colors.artifact`) so saved
 * study material reads as "your notes", not a throwaway chat line.
 *
 * Lead uses Playfair Display italic as a substitute for the spec's "Lora italic"
 * (the app only ships Playfair + Inter; Lora is not loaded).
 */
export function AIArtifactCard({
  type,
  leadText,
  bodyText,
  details,
  onCopy,
  onSave,
  onRegenerate,
  onOpen,
  onOpenLabel,
  loading,
}: AIArtifactCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(`${leadText}\n\n${bodyText}`);
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const handleSave = async () => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerate || regenerating) return;
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  };

  const showReadFull = !!details && details.items.length > 0;

  // ----- Loading skeleton (final shape, no reflow) -----
  if (loading) {
    return (
      <View>
        <View style={styles.eyebrow}>
          <SparklesIcon size={14} color={colors.artifact.inkSoft} />
          <Text style={styles.eyebrowLabel}>STUDYMATE AI</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.tagSkeleton} />
          <View style={[styles.skeletonBar, { width: '85%' }]} />
          <View style={[styles.skeletonBar, { width: '95%' }]} />
          <View style={styles.skeletonGap} />
          <View style={[styles.skeletonBar, { width: '90%' }]} />
          <View style={[styles.skeletonBar, { width: '70%' }]} />
          <View style={[styles.skeletonBar, { width: '80%' }]} />
        </View>
      </View>
    );
  }

  return (
    <View>
      {/* Eyebrow row (above the card) */}
      <View style={styles.eyebrow}>
        <SparklesIcon size={14} color={colors.artifact.inkSoft} />
        <Text style={styles.eyebrowLabel}>STUDYMATE AI</Text>
      </View>

      <View style={styles.card}>
        {/* Single-line type tag */}
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{TAG_LABEL[type]}</Text>
        </View>

        {/* Lead: serif italic one-liner */}
        <Text style={styles.lead}>{leadText}</Text>

        {/* Body: supporting paragraph */}
        <Text style={styles.body}>{bodyText}</Text>

        {/* "Read full →" reveals the collapsible richer content (key terms, etc.) */}
        {showReadFull && (
          <Pressable onPress={() => setExpanded((v) => !v)} style={styles.readFull}>
            <Text style={styles.readFullText}>
              {expanded ? 'Hide details' : onOpenLabel ?? 'Read full summary →'}
            </Text>
          </Pressable>
        )}

        {expanded && details && (
          <View style={styles.details}>
            <Text style={styles.detailsTitle}>{details.title}</Text>
            {details.items.map((it, i) => (
              <View key={i} style={styles.detailItem}>
                {it.term ? (
                  <Text style={styles.detailTerm}>{it.term}</Text>
                ) : null}
                <Text style={styles.detailText}>{it.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action row: Copy / Save / Regenerate */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleCopy}
            accessibilityLabel="Copy artifact"
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          >
            <CopyIcon size={14} color={colors.artifact.inkSoft} />
            <Text style={[styles.actionLabel, { color: colors.artifact.inkSoft }]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={saving || !onSave}
            accessibilityLabel="Save to notes"
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed, !onSave && styles.actionBtnDisabled]}
          >
            <BookmarkCheckIcon size={14} color={colors.artifact.forest} />
            <Text style={[styles.actionLabel, { color: colors.artifact.forest }]}>
              {saving ? 'Saving…' : 'Save to notes'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleRegenerate}
            disabled={regenerating || !onRegenerate}
            accessibilityLabel="Regenerate"
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed, !onRegenerate && styles.actionBtnDisabled]}
          >
            <RefreshIcon size={14} color={colors.artifact.inkSoft} />
            <Text style={[styles.actionLabel, { color: colors.artifact.inkSoft }]}>
              {regenerating ? '…' : 'Regenerate'}
            </Text>
          </Pressable>
        </View>

        {/* Primary CTA for quiz/flashcards: open the full experience */}
        {onOpen && (
          <Pressable
            onPress={onOpen}
            accessibilityLabel={onOpenLabel ?? 'Open'}
            style={({ pressed }) => [styles.openRow, pressed && styles.openRowPressed]}
          >
            <Text style={styles.openText}>{onOpenLabel ?? 'Open full →'}</Text>
            <ChevronRightIcon size={16} color={colors.artifact.forest} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const a = colors.artifact;

const styles = StyleSheet.create({
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginLeft: 2,
  },
  eyebrowLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: a.inkSoft,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: a.cardBg,
    borderWidth: 1,
    borderColor: a.border,
    borderRadius: 16,
    padding: 16,
  },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: a.tagBg,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  tagText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: a.tagText,
    textTransform: 'uppercase',
  },
  lead: {
    fontFamily: typography.serifItalic,
    fontSize: 16,
    lineHeight: 23,
    color: a.ink,
  },
  body: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    lineHeight: 21,
    color: a.inkSoft,
    marginTop: 8,
  },
  readFull: {
    marginTop: 10,
  },
  readFullText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: a.forest,
  },
  details: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: a.border,
    gap: 10,
  },
  detailsTitle: {
    fontFamily: typography.sansBold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: a.ink,
    textTransform: 'uppercase',
  },
  detailItem: {
    gap: 2,
  },
  detailTerm: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: a.ink,
  },
  detailText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    lineHeight: 19,
    color: a.inkSoft,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: a.border,
    paddingTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  actionBtnPressed: {
    backgroundColor: a.tagBg,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 11.5,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: a.tagBg,
  },
  openRowPressed: {
    opacity: 0.8,
  },
  openText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: a.forest,
  },
  // Skeleton
  tagSkeleton: {
    width: 76,
    height: 18,
    borderRadius: 20,
    backgroundColor: a.tagBg,
    marginBottom: 12,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: a.tagBg,
    marginBottom: 8,
  },
  skeletonGap: {
    height: 6,
  },
});
