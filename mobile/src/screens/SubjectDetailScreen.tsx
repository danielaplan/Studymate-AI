import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { SparklesIcon, DocumentIcon, ScanIcon, ChevronRightIcon } from '../components/Icons';
import { SubjectItem } from '../types';
import { listMaterials, uploadMaterial, deleteMaterial, MaterialAPI } from '../api/client';

interface SubjectDetailScreenProps {
  subject: SubjectItem;
  onBack: () => void;
  onProfile: () => void;
  onAskAI: () => void;
  onOpenMaterial: (material: MaterialAPI) => void;
}

export function SubjectDetailScreen({
  subject,
  onBack,
  onProfile,
  onAskAI,
  onOpenMaterial,
}: SubjectDetailScreenProps) {
  const [materials, setMaterials] = useState<MaterialAPI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);

  const subjectIdNum = parseInt(subject.id, 10);

  useEffect(() => {
    if (subjectIdNum) {
      loadMaterials();
    }
  }, [subject.id]);

  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const data = await listMaterials(subjectIdNum);
      setMaterials(data);
      setMaterialsError(null);
    } catch (error: any) {
      setMaterialsError(error?.message || 'Could not load materials from the backend.');
    } finally {
      setIsLoading(false);
    }
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
      <Header showBack onBack={onBack} onProfile={onProfile} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Breadcrumb */}
        <View style={styles.breadcrumbRow}>
          <Text style={styles.breadcrumbText}>SUBJECTS &gt;</Text>
        </View>

        {/* Large Serif Title */}
        <Text style={styles.title}>{subject.name}</Text>

        {/* Description */}
        <Text style={styles.description}>
          {subject.description || 'Upload lecture notes, textbook chapters, or scanned study materials to begin.'}
        </Text>

        <Text style={styles.lastStudiedMeta}>{subject.lastStudied || 'Ready for study session'}</Text>

        <View style={styles.divider} />

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>QUICK ACTIONS</Text>

          <View style={styles.quickActionsList}>
            <Pressable
              accessibilityLabel="Ask AI to explain concepts"
              onPress={onAskAI}
              style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
            >
              <View style={styles.actionIconBadge}>
                <SparklesIcon size={18} color={colors.brandGreen} />
              </View>
              <Text style={styles.actionLabel}>Ask AI to explain concepts</Text>
              <ChevronRightIcon size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable
              accessibilityLabel="Upload new materials"
              onPress={handlePickAndUpload}
              disabled={isUploading}
              style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
            >
              <View style={styles.actionIconBadge}>
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.brandGreen} />
                ) : (
                  <DocumentIcon size={18} color={colors.brandGreen} />
                )}
              </View>
              <Text style={styles.actionLabel}>
                {isUploading ? 'Uploading & parsing text...' : 'Upload PDF / study material'}
              </Text>
              <ChevronRightIcon size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable
              accessibilityLabel="Scan handwritten notes"
              onPress={handlePickAndUpload}
              disabled={isUploading}
              style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
            >
              <View style={styles.actionIconBadge}>
                <ScanIcon size={18} color={colors.brandGreen} />
              </View>
              <Text style={styles.actionLabel}>Scan / upload image notes (OCR)</Text>
              <ChevronRightIcon size={16} color={colors.textMuted} />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },
  breadcrumbRow: { marginBottom: 8 },
  breadcrumbText: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5 },
  title: { fontFamily: typography.serifBold, fontSize: 34, color: colors.textPrimary, marginBottom: 16, letterSpacing: -0.5 },
  description: { fontFamily: typography.sansRegular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, marginBottom: 12 },
  lastStudiedMeta: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 14 },
  section: { paddingVertical: 8 },
  sectionOverline: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 16 },
  quickActionsList: { gap: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight, gap: 14 },
  actionIconBadge: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.sageBadge, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flex: 1, fontFamily: typography.sansMedium, fontSize: 14, color: colors.textPrimary },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  materialsList: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' },
  materialRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 12 },
  materialDocBadge: { width: 28, height: 34, backgroundColor: colors.sageBadge, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  materialInfo: { flex: 1 },
  materialTitle: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.textPrimary },
  materialMeta: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowPressed: { opacity: 0.75 },
  emptyMaterialsCard: { padding: 24, alignItems: 'center', gap: 6 },
  emptyMaterialsTitle: { fontFamily: typography.serifSemiBold, fontSize: 16, color: colors.textPrimary },
  emptyMaterialsSubtitle: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retryButton: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.brandGreen, borderRadius: 6 },
  retryButtonText: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.background },
});
