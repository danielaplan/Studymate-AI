import React, { useState } from 'react';
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
} from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { FolderIcon, SparklesIcon, PaperclipIcon, MicIcon, SendIcon } from '../components/Icons';
import { ChatMessage } from '../types';
import { sendChatMessage } from '../api/client';

interface ChatScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  initialPrompt?: string;
  subjectId?: number;
  subjectName?: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    sender: 'user',
    text: 'Can you summarize the main differences between a stack and a queue from the textbook chapters I uploaded?',
    timestamp: '10:42 AM',
  },
  {
    id: '2',
    sender: 'ai',
    text: 'Based on your uploaded chapters, here are the core differences between a Stack and a Queue in data structures:',
    timestamp: '10:42 AM',
    materialTag: 'COMPUTER SCIENCE MATERIALS',
    bulletPoints: [
      {
        title: 'Operating Principle',
        content: 'Stack follows LIFO (Last In, First Out). Queue follows FIFO (First In, First Out).',
      },
      {
        title: 'Primary Operations',
        content: 'Stack: push() / pop(). Queue: enqueue() / dequeue().',
      },
      {
        title: 'Use Cases',
        content: 'Stack: Function call stack, undo operations. Queue: Task scheduling, BFS.',
      },
    ],
  },
];

export function ChatScreen({
  onOpenMenu,
  onOpenProfile,
  initialPrompt,
  subjectId,
  subjectName,
}: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialPrompt) {
      return [
        ...INITIAL_MESSAGES,
        { id: Date.now().toString(), sender: 'user', text: initialPrompt, timestamp: 'Just now' },
      ];
    }
    return INITIAL_MESSAGES;
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    const prompt = inputText.trim();
    if (!prompt) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: prompt,
      timestamp: 'Just now',
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const data = await sendChatMessage(prompt, subjectId);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.reply,
        timestamp: 'Just now',
        materialTag: subjectName ? `${subjectName.toUpperCase()} MATERIALS` : 'STUDY NOTES',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const fallback: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Here's a grounded answer for "${prompt}" based on your study materials. (Backend offline — connect the FastAPI server for live RAG responses.)`,
        timestamp: 'Just now',
        materialTag: 'OFFLINE MODE',
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setIsLoading(false);
    }
  };

  const contextLabel = subjectName
    ? `${subjectName.toUpperCase()} MATERIALS`
    : 'COMPUTER SCIENCE MATERIALS';

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

              <Text style={styles.messageText}>{msg.text}</Text>

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

          {isLoading && (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator color={colors.brandGreen} size="small" />
              <Text style={styles.loadingText}>Retrieving from your notes...</Text>
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
          <Pressable accessibilityLabel="Attach file" style={styles.iconBtn}>
            <PaperclipIcon size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable accessibilityLabel="Voice input" style={styles.iconBtn}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  contextBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  contextBadgeText: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.2 },
  thread: { gap: 20 },
  messageBubble: { padding: 16, borderRadius: 12 },
  userBubble: { backgroundColor: '#F3F5EE', borderWidth: 1, borderColor: colors.borderLight, alignSelf: 'flex-end', maxWidth: '90%' },
  aiBubble: { backgroundColor: 'transparent', paddingHorizontal: 0 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  aiLabel: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.brandGreen, letterSpacing: 1.5 },
  messageText: { fontFamily: typography.sansRegular, fontSize: 15, lineHeight: 24, color: colors.textPrimary },
  bulletsContainer: { marginTop: 14, gap: 12 },
  bulletItem: { gap: 4 },
  bulletTitle: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.textPrimary },
  bulletContent: { fontFamily: typography.sansRegular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, paddingLeft: 12 },
  loadingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  loadingText: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.borderLight, gap: 10 },
  textInput: { flex: 1, fontFamily: typography.sansRegular, fontSize: 15, color: colors.textPrimary, maxHeight: 90, paddingVertical: 6 },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 6 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandGreen, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#C2C7BC' },
});
