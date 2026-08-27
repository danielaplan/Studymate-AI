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
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { FolderIcon, SparklesIcon, PaperclipIcon, MicIcon, SendIcon } from '../components/Icons';
import { ChatMessage } from '../types';
import { sendChatMessage, uploadMaterial, createSubject } from '../api/client';

interface ChatScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  initialPrompt?: string;
  subjectId?: number;
  subjectName?: string;
}

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
      }
    } catch (err: any) {
      setIsUploading(false);
      Alert.alert('Attachment Error', err.message || 'Could not attach study file.');
    }
  };

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
        materialTag: subjectName ? `${subjectName.toUpperCase()} NOTES` : 'STUDY CITATION',
      };
      setMessages((prev) => [...prev, aiMsg]);
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

  const contextLabel = subjectName
    ? `${subjectName.toUpperCase()} MATERIALS`
    : 'ALL STUDY MATERIALS';

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

          {isUploading && (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator color={colors.brandGreen} size="small" />
              <Text style={styles.loadingText}>Uploading and indexing document chunks...</Text>
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator color={colors.brandGreen} size="small" />
              <Text style={styles.loadingText}>Searching your study materials...</Text>
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
