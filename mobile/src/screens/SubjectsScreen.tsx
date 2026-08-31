import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, Alert, Modal, Animated } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { SearchIcon, CloseIcon, BackIcon } from '../components/Icons';
import { SubjectCard } from '../components/SubjectCard';
import { IconButton } from '../components/IconButton';
import { SubjectItem } from '../types';
import { listSubjects, createSubject, deleteSubject, updateSubject, SubjectAPI } from '../api/client';
import { clearSubjectMemory } from '../storage/subjectMemory';
import { clearQuizHistoryForSubject } from '../storage/quizHistory';
import { clearChatThread } from '../storage/chatThread';

interface SubjectsScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onSelectSubject: (subject: SubjectItem) => void;
  // When provided, the screen is shown as a dismissible overlay (e.g. the
  // workspace "Switch subject" picker) with a Back/✕ that closes it instead of
  // the global header menu. The underlying workspace stays mounted beneath.
  onClose?: () => void;
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

export function SubjectsScreen({ onOpenMenu, onOpenProfile, onSelectSubject, onClose }: SubjectsScreenProps) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedSubjectMenu, setSelectedSubjectMenu] = useState<SubjectItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (!selectedSubjectMenu) {
      Animated.parallel([
        Animated.timing(sheetOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 18, duration: 160, useNativeDriver: true }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(sheetOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [selectedSubjectMenu]);

  const loadSubjects = async () => {
    setIsLoading(true);
    try {
      const apiSubjects = await listSubjects();
      setSubjects(apiSubjects.map(apiToSubjectItem));
    } catch {
      // Backend offline - keep empty list
      setSubjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) {
      Alert.alert('Enter a name', 'Please enter a subject name.');
      return;
    }
    try {
      const created = await createSubject(newSubjectName.trim());
      setSubjects((prev) => [apiToSubjectItem(created), ...prev]);
      setNewSubjectName('');
      setIsAdding(false);
    } catch (err: any) {
      Alert.alert('Could not create subject', err.message || 'Unknown error');
    }
  };

  const sortedSubjects = [...subjects].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const filtered = sortedSubjects.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTogglePin = async (subject: SubjectItem) => {
    const newPinned = !subject.pinned;
    // Optimistic update
    setSubjects((prev) =>
      prev
        .map((item) => (item.id === subject.id ? { ...item, pinned: newPinned } : item))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned))
    );
    setSelectedSubjectMenu(null);
    setShowDeleteConfirm(false);

    try {
      await updateSubject(parseInt(subject.id), { pinned: newPinned });
    } catch (err: any) {
      // Rollback on error
      setSubjects((prev) =>
        prev
          .map((item) => (item.id === subject.id ? { ...item, pinned: !newPinned } : item))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
      );
      Alert.alert('Could not update pin status', err.message || 'Unknown error');
    }
  };

  const handleRenameSubject = async () => {
    if (!selectedSubjectMenu) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      Alert.alert('Enter a new name', 'The subject name cannot be empty.');
      return;
    }

    const previousName = selectedSubjectMenu.name;
    // Optimistic update
    setSubjects((prev) => prev.map((item) => (item.id === selectedSubjectMenu.id ? { ...item, name: trimmed } : item)));
    setSelectedSubjectMenu(null);
    setRenameValue('');
    setShowDeleteConfirm(false);

    try {
      await updateSubject(parseInt(selectedSubjectMenu.id), { name: trimmed });
    } catch (err: any) {
      // Rollback on error
      setSubjects((prev) => prev.map((item) => (item.id === selectedSubjectMenu.id ? { ...item, name: previousName } : item)));
      Alert.alert('Could not rename subject', err.message || 'Unknown error');
    }
  };

  const handleDeleteSubject = async (subject: SubjectItem) => {
    // Optimistic update
    setSubjects((prev) => prev.filter((item) => item.id !== subject.id));
    setSelectedSubjectMenu(null);
    setRenameValue('');
    setShowDeleteConfirm(false);

    try {
      await deleteSubject(parseInt(subject.id));
      // Remove this subject's on-device data alongside it.
      clearSubjectMemory(parseInt(subject.id)).catch(() => {});
      clearQuizHistoryForSubject(parseInt(subject.id)).catch(() => {});
      clearChatThread(parseInt(subject.id)).catch(() => {});
    } catch (err: any) {
      // Rollback on error - reload from server
      Alert.alert('Could not delete subject', err.message || 'Unknown error');
      loadSubjects();
    }
  };

  const closeMenu = () => {
    setSelectedSubjectMenu(null);
    setRenameValue('');
    setShowDeleteConfirm(false);
  };

  return (
    <View style={styles.container}>
      {onClose ? (
        <View style={styles.overlayTopBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close subjects"
            onPress={onClose}
            style={({ pressed }) => [styles.overlayBackBtn, pressed && styles.overlayBackPressed]}
          >
            <BackIcon size={20} color={colors.brandGreen} />
            <Text style={styles.overlayTopTitle}>Subjects</Text>
          </Pressable>
        </View>
      ) : (
        <Header onMenu={onOpenMenu} onProfile={onOpenProfile} />
      )}
      <FlatList
        style={styles.subjectListOuter}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        data={filtered}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <>
            <Text style={styles.libraryTitle}>Subjects Library</Text>

            {/* Search Bar */}
            <View style={styles.searchRow}>
              <SearchIcon size={18} color={colors.textPlaceholder} />
              <TextInput
                placeholder="Search subjects..."
                placeholderTextColor={colors.textPlaceholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
              />
            </View>

            {/* Add New Subject */}
            {isAdding ? (
              <View style={styles.addSubjectForm}>
                <TextInput
                  placeholder="Subject name..."
                  placeholderTextColor={colors.textPlaceholder}
                  value={newSubjectName}
                  onChangeText={setNewSubjectName}
                  style={styles.addSubjectInput}
                  autoFocus
                />
                <View style={styles.addSubjectButtons}>
                  <Pressable onPress={() => setIsAdding(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleAddSubject} style={styles.confirmBtn}>
                    <Text style={styles.confirmBtnText}>Add Subject</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityLabel="Add New Subject"
                onPress={() => setIsAdding(true)}
                style={({ pressed }) => [styles.addSubjectCard, pressed && styles.cardPressed]}
              >
                <Text style={styles.addSubjectText}>+ Add New Subject</Text>
              </Pressable>
            )}

            {/* Section Overline */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionOverline}>ALL SUBJECTS</Text>
              {isLoading && <ActivityIndicator size="small" color={colors.brandGreen} />}
            </View>
          </>
        }
        ListEmptyComponent={
          !isLoading ? <Text style={styles.emptyText}>No subjects found. Add one above!</Text> : null
        }
        ItemSeparatorComponent={() => <View style={styles.subjectRowGap} />}
        renderItem={({ item: subject }) => (
          <SubjectCard
            subject={subject}
            onPress={() => onSelectSubject(subject)}
            onOptionsPress={() => {
              setSelectedSubjectMenu(subject);
              setRenameValue(subject.name);
            }}
          />
        )}
      />

      <Modal
        visible={Boolean(selectedSubjectMenu)}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menuSheet,
              {
                opacity: sheetOpacity,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{selectedSubjectMenu?.name || 'Subject options'}</Text>
              <IconButton onPress={closeMenu} accessibilityLabel="Close menu" icon={<CloseIcon size={16} color={colors.textPrimary} />} />
            </View>

            {showDeleteConfirm && selectedSubjectMenu ? (
              <>
                <View style={styles.confirmationCard}>
                  <Text style={styles.confirmationTitle}>Delete note?</Text>
                  <Text style={styles.confirmationText}>This removes “{selectedSubjectMenu.name}” from your library.</Text>
                </View>

                <View style={styles.menuActionsRow}>
                  <Pressable onPress={() => setShowDeleteConfirm(false)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Keep</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteSubject(selectedSubjectMenu)} style={styles.deletePrimaryButton}>
                    <Text style={styles.deletePrimaryButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Pressable onPress={() => handleTogglePin(selectedSubjectMenu!)} style={styles.menuActionButton}>
                  <Text style={styles.menuActionText}>{selectedSubjectMenu?.pinned ? 'Unpin note' : 'Pin note'}</Text>
                </Pressable>

                <View style={styles.renameBox}>
                  <TextInput
                    value={renameValue}
                    onChangeText={setRenameValue}
                    placeholder="Rename subject..."
                    placeholderTextColor={colors.textPlaceholder}
                    style={styles.renameInput}
                  />
                </View>

                <View style={styles.menuActionsRow}>
                  <Pressable onPress={closeMenu} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleRenameSubject} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Rename</Text>
                  </Pressable>
                </View>

                <Pressable onPress={() => setShowDeleteConfirm(true)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Delete note</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  subjectListOuter: { flex: 1 },
  subjectRowGap: { height: 12 },
  overlayTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  overlayBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingRight: 12,
  },
  overlayBackPressed: { opacity: 0.6 },
  overlayTopTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.brandGreen,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32 },
  libraryTitle: { fontFamily: typography.display, fontSize: 34, color: colors.textPrimary, marginBottom: 22, letterSpacing: -0.8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F7F3',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 22,
    shadowColor: colors.ink,
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchInput: { flex: 1, fontFamily: typography.sansRegular, fontSize: 16, color: colors.textPrimary, paddingVertical: 2 },
  addSubjectCard: {
    height: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F6F2',
    marginBottom: 28,
  },
  addSubjectText: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.brandGreen },
  addSubjectForm: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 28,
    gap: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  addSubjectInput: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.textPrimary, borderBottomWidth: 1, borderBottomColor: colors.borderMedium, paddingBottom: 8 },
  addSubjectButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.borderMedium },
  cancelBtnText: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.textMuted },
  confirmBtn: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.brandGreen },
  confirmBtnText: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.surface },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionOverline: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5 },
  subjectsList: { gap: 12 },
  cardPressed: { opacity: 0.75 },
  emptyText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.36)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  menuSheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 18,
    gap: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuTitle: {
    fontFamily: typography.display,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  menuActionButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.sageBadge,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  menuActionText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  renameBox: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  renameInput: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  menuActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.brandGreen,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.surface,
  },
  confirmationCard: {
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 14,
    backgroundColor: colors.errorSoft,
    padding: 14,
    gap: 6,
  },
  confirmationTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  confirmationText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  deletePrimaryButton: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deletePrimaryButtonText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.surface,
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.error,
  },
});
