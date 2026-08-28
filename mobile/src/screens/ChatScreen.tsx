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
import { ChatMessage, ChatAction, ChatSetupQuestion } from '../types';
import { sendChatMessage, uploadMaterial, createSubject, generateSummary, SummaryAPI } from '../api/client';
import { addMemoryEntry, loadChatMemory } from '../storage/subjectMemory';
import { detectIntent } from '../utils/intent';

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
  // Chat hub: hand off to the EXISTING quiz / flashcard screens with the prefs
  // collected in-chat (launcher card buttons). Kept optional so other callers
  // of ChatScreen are unaffected.
  onStartQuiz?: (prefs: { questionCount: number; difficulty: 'easy' | 'medium' | 'hard'; timeLimit: number | null }) => void;
  onStartCards?: (prefs: { cardCount: number; focus: 'definitions' | 'concepts' | 'qa' }) => void;
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
  onStartQuiz,
  onStartCards,
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

  // --- Chat hub (idea 2026-08-28): the subject chat is the single hub. ---
  // Quiz / flashcards / summary requests are handled IN the chat:
  //   summary    -> generateSummary + inline SummaryCard (existing component)
  //   quiz       -> conversational setup (count, difficulty) -> launcher card
  //                 whose button hands off to the EXISTING QuizScreen with prefs
  //   flashcards -> conversational setup (count, focus) -> launcher card -> the
  //                 EXISTING FlashcardsScreen
  // Intent = detectIntent keyword regex — zero AI cost, no per-message LLM
  // parsing (guard-M2 principle). Setup inputs are chips only (decision 5).
  // Setup is CONVERSATIONAL (user feedback 2026-08-28): the AI asks each setup
  // question in a chat bubble with chips inside it; tapping a chip records the
  // answer as the user's own bubble, then the next question bubble appears.
  // No bar above the input box.

  const appendAiMessage = (msg: Partial<ChatMessage>) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sender: 'ai',
        text: '',
        timestamp: 'Just now',
        ...msg,
      },
    ]);
  };

  const appendUserMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, sender: 'user', text, timestamp: 'Just now' },
    ]);
  };

  // Plain grounded chat (the pre-hub behavior) for non-action questions.
  const sendPlainChat = async (prompt: string) => {
    setIsLoading(true);
    try {
      const data = await sendChatMessage(prompt, subjectId);
      const reply = data.reply;
      appendAiMessage({
        text: reply,
        materialTag: subjectName ? `${subjectName.toUpperCase()} NOTES` : 'STUDY CITATION',
      });
      persistChat('ai', reply);
    } catch (err: any) {
      appendAiMessage({
        text: `Error connecting to StudyMate backend: ${err?.message || 'Unable to reach API'}. Please ensure FastAPI is running on port 8000.`,
        materialTag: 'CONNECTION ERROR',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummaryIntent = async () => {
    if (subjectId == null) return;
    setIsLoading(true);
    try {
      const summary = await generateSummary(subjectId);
      appendAiMessage({
        materialTag: subjectName ? `${subjectName.toUpperCase()} SUMMARY` : 'SUBJECT SUMMARY',
        summary,
      });
      persistChat('ai', `Generated a summary of ${subjectName ?? 'the subject'}.`);
    } catch (err: any) {
      appendAiMessage({
        text: `I couldn't generate the summary: ${err?.message || 'Unable to reach API'}. Check that the backend is running and try again.`,
        materialTag: 'SUMMARY ERROR',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Ask one setup question as a chat bubble (chips render inside it while it
  // is the last message). Earlier answers (`count`, `difficulty`) are carried
  // forward stage by stage.
  const askSetup = (
    kind: 'quiz' | 'flashcards',
    stage: 'count' | 'difficulty' | 'time' | 'focus',
    count?: number,
    difficulty?: 'easy' | 'medium' | 'hard',
  ) => {
    const text =
      stage === 'count'
        ? kind === 'quiz'
          ? 'Sure — how many questions do you want?'
          : 'Sure — how many cards should the deck have?'
        : stage === 'difficulty'
          ? 'Got it. What difficulty?'
          : stage === 'time'
            ? 'And a time limit?'
            : 'Got it. What should the cards focus on?';
    appendAiMessage({ text, setup: { kind, stage, count, difficulty } });
  };

  // Single owner of "what does this message do" — used by both manual sends
  // and the smart-box auto-send effect.
  const routePrompt = async (prompt: string) => {
    const intent = detectIntent(prompt);

    // No subject -> nothing to summarize/quiz/flashcard from. Guide inline
    // (same inline-guidance principle as the Home box; plain questions still
    // go to general grounded chat).
    if (subjectId == null) {
      if (intent === 'quiz' || intent === 'flashcards' || intent === 'summary') {
        appendAiMessage({
          text:
            'Open a subject first — quizzes, flashcards, and summaries are built from a subject\'s notes. Go to Subjects, pick one, and ask me there.',
          materialTag: 'NO SUBJECT',
        });
        return;
      }
      await sendPlainChat(prompt);
      return;
    }

    if (intent === 'summary') {
      await handleSummaryIntent();
      return;
    }
    if (intent === 'quiz') {
      askSetup('quiz', 'count');
      return;
    }
    if (intent === 'flashcards') {
      askSetup('flashcards', 'count');
      return;
    }
    if (intent === 'review') {
      askChoice();
      return;
    }
    await sendPlainChat(prompt);
  };

  // Ambiguous study-help request ("review me on this file", "help me study")
  // — the user wants to study but didn't name a format. Don't guess: ask back
  // with a choice bubble (quiz / flashcards / summary). kind is a placeholder
  // here; the tapped chip decides the real flow.
  const askChoice = () => {
    appendAiMessage({
      text: 'How do you want to study this?',
      setup: { kind: 'quiz', stage: 'choice' },
    });
  };

  const handleSetupChoice = (msgId: string, choice: 'quiz' | 'flashcards' | 'summary') => {
    answerSetup(
      msgId,
      choice === 'quiz' ? 'Quiz me' : choice === 'flashcards' ? 'Flashcards' : 'Summarize it',
    );
    if (choice === 'summary') {
      handleSummaryIntent();
      return;
    }
    askSetup(choice, 'count');
  };

  // Slim in-chat setup (decision 4): quiz = count + difficulty; flashcards =
  // count + focus. Two taps, then a launcher card appears in the thread.
  // Conversational: strip the question's chips (answered), record the answer
  // as the user's bubble, then ask the next question or build the launcher.
  const answerSetup = (msgId: string, answerText: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, setup: undefined } : m)));
    appendUserMessage(answerText);
  };

  const handleSetupCount = (msgId: string, setup: ChatSetupQuestion, count: number) => {
    answerSetup(msgId, `${count} ${setup.kind === 'quiz' ? 'questions' : 'cards'}`);
    askSetup(setup.kind, setup.kind === 'quiz' ? 'difficulty' : 'focus', count);
  };

  const handleSetupDifficulty = (msgId: string, setup: ChatSetupQuestion, difficulty: 'easy' | 'medium' | 'hard') => {
    if (setup.count == null) return;
    answerSetup(msgId, difficulty.charAt(0).toUpperCase() + difficulty.slice(1));
    // Quiz setup asks time last (added 2026-08-28: "it did not ask for time").
    askSetup('quiz', 'time', setup.count, difficulty);
  };

  const handleSetupTime = (msgId: string, setup: ChatSetupQuestion, timeLimit: number | null) => {
    if (setup.count == null || !setup.difficulty) return;
    const count = setup.count;
    const difficulty = setup.difficulty;
    answerSetup(msgId, timeLimit == null ? 'No time limit' : `${timeLimit} min`);
    const timePart = timeLimit == null ? '' : `, ${timeLimit}-minute limit`;
    const label = `${count}-question ${difficulty} quiz${subjectName ? ` on ${subjectName}` : ''}${timePart}`;
    appendAiMessage({
      text: `Your ${label} is ready — tap below to start it.`,
      materialTag: 'QUIZ READY',
      action: { kind: 'quiz', label, questionCount: count, difficulty, timeLimit },
    });
    persistChat('ai', `Quiz ready: ${label}`);
  };

  const handleSetupFocus = (msgId: string, setup: ChatSetupQuestion, focus: 'definitions' | 'concepts' | 'qa') => {
    if (setup.count == null) return;
    const count = setup.count;
    answerSetup(msgId, focus === 'qa' ? 'Q&A' : focus.charAt(0).toUpperCase() + focus.slice(1));
    const focusLabel = focus === 'qa' ? 'Q&A' : focus;
    const label = `${count} ${focusLabel} flashcards${subjectName ? ` on ${subjectName}` : ''}`;
    appendAiMessage({
      text: `Your deck of ${label} is ready — tap below to start reviewing.`,
      materialTag: 'FLASHCARDS READY',
      action: { kind: 'flashcards', label, cardCount: count, focus },
    });
    persistChat('ai', `Flashcards ready: ${label}`);
  };

  // Launcher card button -> hand off to the EXISTING dedicated screens with
  // the prefs collected in-chat (they generate their own content from prefs).
  const handleOpenAction = (action: ChatAction) => {
    if (action.kind === 'quiz' && onStartQuiz && action.questionCount != null && action.difficulty) {
      onStartQuiz({
        questionCount: action.questionCount,
        difficulty: action.difficulty,
        timeLimit: action.timeLimit ?? null,
      });
    } else if (action.kind === 'flashcards' && onStartCards && action.cardCount != null && action.focus) {
      onStartCards({ cardCount: action.cardCount, focus: action.focus });
    }
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
    await routePrompt(prompt);
  };

  const handleSendMessage = () => submitPrompt(inputText);

  // Smart study box handoff (Slice 4): when opened with a pre-filled prompt, the
  // user bubble is already seeded (initial state) and persisted (memory effect
  // above). This effect routes it through the chat hub so the user gets an
  // answer (or an in-chat quiz/flashcards/summary flow) without tapping send.
  useEffect(() => {
    if (!initialPrompt || initialSummary) return;
    routePrompt(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

              {/* Chat-hub launcher card: opens the existing quiz/flashcards
                  screen with the prefs collected in-chat. */}
              {msg.action && (
                <Pressable
                  accessibilityLabel={`Open ${msg.action.label}`}
                  onPress={() => handleOpenAction(msg.action!)}
                  style={({ pressed }) => [styles.launcherCard, pressed && styles.launcherCardPressed]}
                >
                  <View style={styles.launcherIconBadge}>
                    <SparklesIcon size={18} color={colors.brandGreen} />
                  </View>
                  <View style={styles.launcherInfo}>
                    <Text style={styles.launcherLabel}>{msg.action.label}</Text>
                    <Text style={styles.launcherHint}>
                      {msg.action.kind === 'quiz' ? 'Tap to start the quiz' : 'Tap to start reviewing'}
                    </Text>
                  </View>
                  <ChevronRightIcon size={18} color={colors.textMuted} />
                </Pressable>
              )}

              {/* Chat-hub conversational setup: chips live inside the asking
                  bubble, and only while it's still the last (unanswered)
                  message. Answering strips them and posts the user's answer. */}
              {msg.setup && msg.id === messages[messages.length - 1]?.id && (
                <View style={styles.setupChips}>
                  {msg.setup.stage === 'choice' &&
                    ([
                      { label: 'Quiz me', value: 'quiz' },
                      { label: 'Flashcards', value: 'flashcards' },
                      { label: 'Summarize it', value: 'summary' },
                    ] as const).map((c) => (
                      <Pressable
                        key={c.value}
                        onPress={() => handleSetupChoice(msg.id, c.value)}
                        style={({ pressed }) => [styles.setupChip, pressed && styles.setupChipPressed]}
                      >
                        <Text style={styles.setupChipText}>{c.label}</Text>
                      </Pressable>
                    ))}
                  {msg.setup.stage === 'count' &&
                    [5, 10, 15, 20].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => handleSetupCount(msg.id, msg.setup!, n)}
                        style={({ pressed }) => [styles.setupChip, pressed && styles.setupChipPressed]}
                      >
                        <Text style={styles.setupChipText}>{n}</Text>
                      </Pressable>
                    ))}
                  {msg.setup.stage === 'difficulty' &&
                    (['easy', 'medium', 'hard'] as const).map((d) => (
                      <Pressable
                        key={d}
                        onPress={() => handleSetupDifficulty(msg.id, msg.setup!, d)}
                        style={({ pressed }) => [styles.setupChip, pressed && styles.setupChipPressed]}
                      >
                        <Text style={styles.setupChipText}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
                      </Pressable>
                    ))}
                  {msg.setup.stage === 'time' &&
                    ([
                      { label: 'Off', value: null },
                      { label: '5 min', value: 5 },
                      { label: '10 min', value: 10 },
                      { label: '15 min', value: 15 },
                    ] as { label: string; value: number | null }[]).map((t) => (
                      <Pressable
                        key={t.label}
                        onPress={() => handleSetupTime(msg.id, msg.setup!, t.value)}
                        style={({ pressed }) => [styles.setupChip, pressed && styles.setupChipPressed]}
                      >
                        <Text style={styles.setupChipText}>{t.label}</Text>
                      </Pressable>
                    ))}
                  {msg.setup.stage === 'focus' &&
                    ([
                      { label: 'Definitions', value: 'definitions' },
                      { label: 'Concepts', value: 'concepts' },
                      { label: 'Q & A', value: 'qa' },
                    ] as const).map((f) => (
                      <Pressable
                        key={f.value}
                        onPress={() => handleSetupFocus(msg.id, msg.setup!, f.value)}
                        style={({ pressed }) => [styles.setupChip, pressed && styles.setupChipPressed]}
                      >
                        <Text style={styles.setupChipText}>{f.label}</Text>
                      </Pressable>
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
  // Chat-hub launcher card (quiz / flashcards ready)
  launcherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brandGreenLight,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  launcherCardPressed: { opacity: 0.85 },
  launcherIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launcherInfo: { flex: 1 },
  launcherLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  launcherHint: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  // Chat-hub conversational setup chips (rendered inside the asking bubble)
  setupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  setupChip: {
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  setupChipPressed: { backgroundColor: colors.brandGreenSoft, borderColor: colors.brandGreen },
  setupChipText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
