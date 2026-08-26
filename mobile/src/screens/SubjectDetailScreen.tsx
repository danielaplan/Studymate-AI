import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { SparklesIcon, DocumentIcon, ScanIcon, ChevronRightIcon } from '../components/Icons';
import { SubjectItem } from '../types';

interface SubjectDetailScreenProps {
  subject: SubjectItem;
  onBack: () => void;
  onProfile: () => void;
  onAskAI: () => void;
  onUploadMaterials: () => void;
  onScanNotes: () => void;
  onOpenMaterial: (materialName: string) => void;
}

export function SubjectDetailScreen({
  subject,
  onBack,
  onProfile,
  onAskAI,
  onUploadMaterials,
  onScanNotes,
  onOpenMaterial,
}: SubjectDetailScreenProps) {
  const materials = [
    { title: 'Chapter 3: Symmetric Encryption Standards', type: 'PDF Document', size: '2.4 MB' },
    { title: 'Chapter 4: Data Structures (Stacks & Queues)', type: 'PDF Document', size: '3.1 MB' },
    { title: 'Lecture 2: Big-O Complexity Notes', type: 'Handwritten Scan', size: '1.8 MB' },
    { title: 'Midterm Review Deck', type: 'Generated Deck', size: '15 Cards' },
  ];

  return (
    <View style={styles.container}>
      <Header showBack onBack={onBack} onProfile={onProfile} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Breadcrumb */}
        <View style={styles.breadcrumbRow}>
          <Text style={styles.breadcrumbText}>SUBJECTS &gt;</Text>
        </View>

        {/* Large Serif Title */}
        <Text style={styles.title}>{subject.name}</Text>

        {/* Description */}
        <Text style={styles.description}>
          {subject.description ||
            'Algorithms, Data Structures, and Systems Architecture. Focus on module 4 preparation for the upcoming midterms.'}
        </Text>

        <Text style={styles.lastStudiedMeta}>{subject.lastStudied || 'Last studied 2 hrs ago'}</Text>

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
              onPress={onUploadMaterials}
              style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
            >
              <View style={styles.actionIconBadge}>
                <DocumentIcon size={18} color={colors.brandGreen} />
              </View>
              <Text style={styles.actionLabel}>Upload new materials</Text>
              <ChevronRightIcon size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable
              accessibilityLabel="Scan handwritten notes"
              onPress={onScanNotes}
              style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
            >
              <View style={styles.actionIconBadge}>
                <ScanIcon size={18} color={colors.brandGreen} />
              </View>
              <Text style={styles.actionLabel}>Scan handwritten notes</Text>
              <ChevronRightIcon size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Study Materials */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionOverline}>STUDY MATERIALS</Text>
            <Pressable accessibilityLabel="View all study materials">
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>

          <View style={styles.materialsList}>
            {materials.map((item, idx) => (
              <Pressable
                key={idx}
                accessibilityLabel={`Open ${item.title}`}
                onPress={() => onOpenMaterial(item.title)}
                style={({ pressed }) => [styles.materialRow, pressed && styles.rowPressed]}
              >
                <View style={styles.materialDocBadge}>
                  <DocumentIcon size={16} color={colors.brandGreen} />
                </View>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialTitle}>{item.title}</Text>
                  <Text style={styles.materialMeta}>{item.type} • {item.size}</Text>
                </View>
                <ChevronRightIcon size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
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
    paddingTop: 24,
    paddingBottom: 36,
  },
  breadcrumbRow: {
    marginBottom: 8,
  },
  breadcrumbText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: typography.serifBold,
    fontSize: 34,
    color: colors.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  lastStudiedMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 14,
  },
  section: {
    paddingVertical: 8,
  },
  sectionOverline: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  quickActionsList: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 14,
  },
  actionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.sageBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  viewAllText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.brandGreen,
  },
  materialsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  materialDocBadge: {
    width: 28,
    height: 34,
    backgroundColor: colors.sageBadge,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  materialMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowPressed: {
    opacity: 0.75,
  },
});
