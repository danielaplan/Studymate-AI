import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { FolderIcon, SparklesIcon, PaperclipIcon, MicIcon, SendIcon, ChevronRightIcon } from '../components/Icons';
import { ChatMessage } from '../types';
import { sendChatMessage, uploadMaterial, createSubject, SummaryAPI } from '../api/client';
import { addMemoryEntry, loadChatMemory } from '../storage/subjectMemory';

interface ChatScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  initialPrompt?: string;
  subjectId?: number;
  subjectName?: string;
  initialSummary?: SummaryAPI;
  onSummaryConsumed?: () => void;
  // When set (opened from the subject's "Explain" quick action), the suggestion
  // row shows tappable "Explain: <term>" chips derived from the subject summary.
  explainTerms?: { term: string; explanation: string }[] | null;
}

function renderFormattedReply(text: string) {
  const sourceMatch = text.match(/\[(CHUNK\s+\d+(?:\s*,\s*CHUNK\s+\d+)*)\]/gi);
  const cleanedText = text
    .replace(/\[(CHUNK\s+\d+(?:\s*,\s*CHUNK\s+\d+)*)\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const renderInline = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g);
    return parts.map((part, index) => {
      if (/^\*\*.+\*\*$/.test(part) || /^__.+__$/.test(part)) {
        return <Text key={index} style={styles.replyStrong}>{part.slice(2, -2)}</Text>;
      }
      if (/^`.+`$/.test(part)) {
        return <Text key={index} style={styles.replyCode}>{part.slice(1, -1)}</Text>;
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  return (
    <>
      {cleanedText.split('\n').map((line, index) => (
        <Text key={index} style={line.trim() ? styles.replyLine : styles.replySpacer}>
          {renderInline(line.trim())}
        </Text>
      ))}
      {sourceMatch && (
        <Text style={styles.sourceLabel}>
          Sources: {sourceMatch[1].replace(/CHUNK\s+/gi, 'Chunk ')}
        </Text>
      )}
    </>
  );
}

function SummaryCard({ summary }: { summary: SummaryAPI }) {
  return (
    <View style={styles.summaryCard}>
      {summary.subtitle ? (
        <Text style={styles.summaryCardTitle}>{summary.subtitle}</Text>
      ) : null}

      {summary.overview_paragraphs?.map((p, i) => (
        <Text key={`p${i}`} style={styles.summaryCardPara}>{p}</Text>
      ))}

      {summary.key_terms?.length ? (
        <View style={styles.summaryCardSection}>
          <Text style={styles.summaryCardSectionLabel}>Key Terms</Text>
          {summary.key_terms.map((kt, i) => (
            <View key={`kt${i}`} style={styles.summaryCardTerm}>
              <Text style={styles.summaryCardTermName}>{kt.term}</Text>
              <Text style={styles.summaryCardTermDef}>{kt.explanation}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {summary.takeaways?.length ? (
        <View style={styles.summaryCardSection}>
          <Text style={styles.summaryCardSectionLabel}>Key Takeaways</Text>
          {summary.takeaways.map((t, i) => (
            <View key={`t${i}`} style={styles.summaryCardTakeaway}>
              <Text style={styles.summaryCardBullet}>•</Text>
              <Text style={styles.summaryCardTakeawayText}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ChatScreen({
  onOpenMenu,
  onOpenProfile,
  initialPrompt,
  subjectId,
  subjectName,
  initialSummary,
  onSummaryConsumed,
  explainTerms,
}: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialSummary) {
      // Start with the structured summary already generated (no API call).
      return [
        {
          id: 'summary',
          sender: 'ai',
          text: '',
          timestamp: 'Summary',
          materialTag: 'SUBJECT SUMMARY',
          summary: initialSummary,
        },
      ];
    }
    if (initialPrompt) {
      return [
        { id: Date.now().toString(), sender: 'user', text: initialPrompt, timestamp: 'Just now' },
      ];
    }
    return [
      {
        id: 'welcome',
        sender: 'ai',
        text: 'Welcome to StudyMate AI. Ask me any questions about your course materials, or tap the paperclip icon to upload new notes.',
        timestamp: 'Ready',
      },
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // When opened from a subject's summary card ("Both" mode): fire one chat call
  // to generate a short intro line that frames the topic, shown above the
  // structured summary. The summary itself needed no extra call.
  useEffect(() => {
    if (!initialSummary || !subjectId) return;

    const buildIntro = (text: string): ChatMessage => ({
      id: 'intro',
      sender: 'ai',
      text,
      timestamp: 'Just now',
      materialTag: subjectName ? `${subjectName.toUpperCase()} NOTES` : 'SUMMARY INTRO',
    });

    // Reuse a previously generated intro for this subject (no extra API call).
    const cached = introCache.get(subjectId);
    if (cached) {
      setMessages((prev) => [buildIntro(cached), ...prev]);
      onSummaryConsumed?.();
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    sendChatMessage(
      'Give a brief, friendly one or two sentence introduction that frames what this subject is about, based on the student\'s notes. Keep it very short — a full structured summary is shown below.',
      subjectId,
    )
      .then((data) => {
        if (cancelled) return;
        // If generation failed (e.g. daily quota reached), don't show an empty
        // or error line — the structured summary card is enough on its own.
        if (isGenerationErrorReply(data.reply)) return;
        introCache.set(subjectId, data.reply);
        setMessages((prev) => [buildIntro(data.reply), ...prev]);
      })
      .catch(() => {
        // If the intro call fails, the structured summary still stands on its own.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
        onSummaryConsumed?.();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load prior on-device chat memory for this subject so conversations are
  // remembered across sessions (visible history + continued context). Skips
  // when the screen was opened with a preset prompt or summary.
  useEffect(() => {
    if (!subjectId) return;
    if (initialPrompt) {
      addMemoryEntry({
        type: 'chat',
        subjectId,
        role: 'user',
        text: initialPrompt,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
      return;
    }
    if (initialSummary) return;
    loadChatMemory(subjectId)
      .then((entries) => {
        if (entries.length === 0) return;
        setMessages(
          entries.map((e) => ({
            id: e.id,
            sender: e.role === 'user' ? 'user' : 'ai',
            text: e.text || '',
            timestamp: 'Saved',
          }))
        );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const handleAttachFile = async () => {
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

        let targetSubId = subjectId;
        if (!targetSubId) {
          const newSub = await createSubject('Chat Uploads', 'Materials uploaded from AI chat');
          targetSubId = newSub.id;
        }

        const uploaded = await uploadMaterial(
          targetSubId,
          file.uri,
          file.name,
          file.mimeType || 'application/pdf',
          (file as any).file
        );

        await addMemoryEntry({
          type: 'upload',
          subjectId: targetSubId,
          fileName: file.name,
          timestamp: new Date().toISOString(),
        }).catch(() => {});

        setIsUploading(false);

        // Add a system announcement message into chat
        const confirmationMsg: ChatMessage = {
          id: Date.now().toString(),
          sender: 'ai',
          text: `📄 Uploaded & Indexed "${file.name}" (${uploaded.chunks_count} chunks). You can now ask any question about this document!`,
          timestamp: 'Just now',
          materialTag: 'DOCUMENT ATTACHED',
        };
        setMessages((prev) => [...prev, confirmationMsg]);
        persistChat('ai', confirmationMsg.text);
      }
    } catch (err: any) {
      setIsUploading(false);
      Alert.alert('Attachment Error', err.message || 'Could not attach study file.');
    }
  };

  // Persist a chat message into this subject's on-device memory (no-op when
  // the chat isn't tied to a subject).
  const persistChat = (role: 'user' | 'ai', text?: string) => {
    if (!subjectId || !text) return;
    addMemoryEntry({
      type: 'chat',
      subjectId,
      role,
      text,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  };

  const submitPrompt = async (rawText: string) => {
    const prompt = rawText.trim();
    if (!prompt) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: prompt,
      timestamp: 'Just now',
    };
    setMessages((prev) => [...prev, userMsg]);
    persistChat('user', prompt);
    setInputText('');
    setIsLoading(true);

    try {
      const data = await sendChatMessage(prompt, subjectId);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.reply,
        timestamp: 'Just now',
        materialTag: subjectName ? `${subjectName.toUpperCase()} NOTES` : 'STUDY CITATION',
      };
      setMessages((prev) => [...prev, aiMsg]);
      persistChat('ai', data.reply);
    } catch (err: any) {
      const fallback: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Error connecting to StudyMate backend: ${err.message || 'Unable to reach API'}. Please ensure FastAPI is running on port 8000.`,
        timestamp: 'Just now',
        materialTag: 'CONNECTION ERROR',
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => submitPrompt(inputText);

  const contextLabel = subjectName
    ? `${subjectName.toUpperCase()} MATERIALS`
    : 'ALL STUDY MATERIALS';

  const promptSuggestions = [
    'Explain the main ideas in these notes.',
    'Create a short quiz from this material.',
    'Turn this into flashcards.',
    'Summarize the key takeaways.',
  ];

  // Explain-mode: derive tappable "Explain: <term>" chips from the subject's
  // summary key terms (scales per subject). Tapping sends the question directly.
  // If no summary terms are available, fall back to the fixed prompt chips.
  const explainChips = (() => {
    if (!explainTerms || explainTerms.length === 0) return null;
    const chips: { label: string; onTap: () => void }[] = explainTerms.slice(0, 6).map((kt) => ({
      label: `Explain: ${kt.term}`,
      onTap: () => submitPrompt(`Explain "${kt.term}" from my study notes.`),
    }));
    chips.push({ label: 'Main ideas', onTap: () => submitPrompt('Explain the main ideas in these notes.') });
    chips.push({ label: 'Simplify it', onTap: () => submitPrompt('Explain the key concepts in plain, simple language.') });
    return chips;
  })();

  const suggestions = explainChips ?? promptSuggestions.map((p) => ({ label: p, onTap: () => setInputText(p) }));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header onMenu={onOpenMenu} onProfile={onOpenProfile} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Context Material Badge */}
        <View style={styles.contextBadge}>
          <FolderIcon size={14} color={colors.textMuted} />
          <Text style={styles.contextBadgeText}>{contextLabel}</Text>
        </View>

        <View style={styles.promptSuggestions}>
          {suggestions.map((s) => (
            <Pressable
              key={s.label}
              accessibilityLabel={`Use prompt ${s.label}`}
              onPress={s.onTap}
              style={({ pressed }) => [styles.promptChip, pressed && styles.promptChipPressed]}
            >
              <Text style={styles.promptChipText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Message Thread */}
        <View style={styles.thread}>
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.messageBubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble]}
            >
              {msg.sender === 'ai' && (
                <View style={styles.aiHeader}>
                  <SparklesIcon size={16} color={colors.brandGreen} />
                  <Text style={styles.aiLabel}>STUDYMATE AI</Text>
                </View>
              )}

              {msg.materialTag && (
                <View style={styles.materialTagBadge}>
                  <Text style={styles.materialTagText}>{msg.materialTag}</Text>
                </View>
              )}

              {msg.summary ? (
                <SummaryCard summary={msg.summary} />
              ) : msg.sender === 'ai' ? (
                <View style={styles.replyContent}>{renderFormattedReply(msg.text)}</View>
              ) : (
                <Text style={styles.messageText}>{msg.text}</Text>
              )}

              {msg.bulletPoints && (
                <View style={styles.bulletsContainer}>
                  {msg.bulletPoints.map((bp, idx) => (
                    <View key={idx} style={styles.bulletItem}>
                      <Text style={styles.bulletTitle}>• {bp.title}:</Text>
                      <Text style={styles.bulletContent}>{bp.content}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          {isUploading && (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator color={colors.brandGreen} size="small" />
              <Text style={styles.loadingText}>Uploading and indexing document chunks...</Text>
            </View>
          )}

          {isLoading && (
            <View style={styles.typingBubble}>
              <View style={styles.aiHeader}>
                <SparklesIcon size={16} color={colors.brandGreen} />
                <Text style={styles.aiLabel}>STUDYMATE AI</Text>
              </View>
              <View style={styles.typingRow}>
                <ActivityIndicator color={colors.brandGreen} size="small" />
                <Text style={styles.loadingText}>
                  {initialSummary ? 'Preparing your summary…' : 'Generating a response…'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          placeholder="Ask about your study materials..."
          placeholderTextColor={colors.textPlaceholder}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
          returnKeyType="send"
          style={styles.textInput}
        />
        <View style={styles.actionButtons}>
          <Pressable
            accessibilityLabel="Attach file"
            onPress={handleAttachFile}
            disabled={isUploading}
            style={styles.iconBtn}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.brandGreen} />
            ) : (
              <PaperclipIcon size={18} color={colors.brandGreen} />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Voice input"
            onPress={() => Alert.alert('Voice Input', 'Speak your question or prompt.')}
            style={styles.iconBtn}
          >
            <MicIcon size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable
            accessibilityLabel="Send message"
            onPress={handleSendMessage}
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          >
            <SendIcon size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Session-level cache for the summary intro line, keyed by subject id.
// Avoids burning a Gemini request (and showing nothing useful) on every
// tap/expand of the same subject's summary.
const introCache = new Map<number, string>();

// The backend returns this phrasing when generation fails (quota / API key).
// When that happens the intro adds nothing useful — skip it so the structured
// summary card stands on its own.
function isGenerationErrorReply(reply: string): boolean {
  const r = reply.toLowerCase();
  return (
    !reply.trim() ||
    r.includes('had trouble generating a response') ||
    r.includes('check your api key')
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  contextBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, paddingHorizontal: 6 },
  contextBadgeText: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.3 },
  promptSuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  promptChip: { backgroundColor: '#F7F5F1', borderWidth: 1, borderColor: colors.borderLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  promptChipPressed: { opacity: 0.75 },
  promptChipText: { fontFamily: typography.sansMedium, fontSize: 12, color: colors.textPrimary },
  thread: { gap: 18 },
  messageBubble: { padding: 16, borderRadius: 20 },
  userBubble: { backgroundColor: '#F7F5F0', borderWidth: 1, borderColor: colors.borderLight, alignSelf: 'flex-end', maxWidth: '90%', shadowColor: '#000000', shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  aiBubble: { backgroundColor: 'transparent', paddingHorizontal: 0 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiLabel: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.brandGreen, letterSpacing: 1.5 },
  materialTagBadge: { alignSelf: 'flex-start', backgroundColor: colors.brandGreenSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10 },
  materialTagText: { fontFamily: typography.sansSemiBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.brandGreen },
  messageText: { fontFamily: typography.sansRegular, fontSize: 15, lineHeight: 24, color: colors.textPrimary },
  replyContent: { gap: 2 },
  replyLine: { fontFamily: typography.sansRegular, fontSize: 15, lineHeight: 24, color: colors.textPrimary },
  replySpacer: { height: 10 },
  replyStrong: { fontFamily: typography.sansSemiBold, color: colors.textPrimary },
  replyCode: { fontFamily: typography.sansMedium, color: colors.brandGreen, backgroundColor: colors.sageBadge, borderRadius: 6, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2 },
  sourceLabel: { marginTop: 12, fontFamily: typography.sansMedium, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  bulletsContainer: { marginTop: 14, gap: 12 },
  bulletItem: { gap: 4 },
  bulletTitle: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.textPrimary },
  bulletContent: { fontFamily: typography.sansRegular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, paddingLeft: 12 },
  summaryCard: {
    backgroundColor: colors.brandGreenSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brandGreenLight,
    padding: 16,
    gap: 10,
  },
  summaryCardTitle: {
    fontFamily: typography.serifMedium,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  summaryCardPara: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryCardSection: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.brandGreenLight,
    gap: 6,
  },
  summaryCardSectionLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.brandGreenDark,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryCardTerm: { gap: 2 },
  summaryCardTermName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13.5,
    color: colors.brandGreenDark,
  },
  summaryCardTermDef: {
    fontFamily: typography.sansRegular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  summaryCardTakeaway: { flexDirection: 'row', gap: 8 },
  summaryCardBullet: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.brandGreen,
  },
  summaryCardTakeawayText: {
    fontFamily: typography.sansRegular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    flex: 1,
  },
  loadingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  loadingText: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted },
  typingBubble: {
    backgroundColor: colors.brandGreenSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brandGreenLight,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255, 255, 255, 0.72)', borderTopWidth: 1, borderTopColor: colors.line, gap: 10 },
  textInput: { flex: 1, fontFamily: typography.sansRegular, fontSize: 15, color: colors.textPrimary, maxHeight: 90, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surfaceMuted, borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brandGreen, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sendBtnDisabled: { backgroundColor: '#C2C7BC' },
});
