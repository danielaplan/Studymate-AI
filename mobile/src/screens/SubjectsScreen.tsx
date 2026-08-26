import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { SearchIcon } from '../components/Icons';
import { SubjectCard } from '../components/SubjectCard';
import { SubjectItem } from '../types';
import { listSubjects, createSubject, SubjectAPI } from '../api/client';

interface SubjectsScreenProps {
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onSelectSubject: (subject: SubjectItem) => void;
  onAddNewSubject?: () => void;
}

function apiToSubjectItem(api: SubjectAPI): SubjectItem {
  return {
    id: String(api.id),
    name: api.name,
    materialsCount: api.materials_count,
    mastery: Math.round(api.mastery),
    description: api.description,
  };
}

// Fallback demo subjects when backend is offline
const DEMO_SUBJECTS: SubjectItem[] = [
  { id: '1', name: 'Computer Science', materialsCount: 12, mastery: 75, description: 'Algorithms, Data Structures, and Systems Architecture.', lastStudied: 'Last studied 2 hrs ago' },
  { id: '2', name: 'Advanced Calculus', materialsCount: 8, mastery: 50, description: 'Multivariable calculus and vector fields.' },
  { id: '3', name: 'Info Assurance', materialsCount: 9, mastery: 40, description: 'Cryptography, network security, and encryption standards.' },
  { id: '4', name: 'Cellular Biology', materialsCount: 15, mastery: 88, description: 'Cellular respiration, metabolic pathways, and DNA synthesis.' },
];

export function SubjectsScreen({ onOpenMenu, onOpenProfile, onSelectSubject, onAddNewSubject }: SubjectsScreenProps) {
  const [subjects, setSubjects] = useState<SubjectItem[]>(DEMO_SUBJECTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    setIsLoading(true);
    try {
      const apiSubjects = await listSubjects();
      if (apiSubjects.length > 0) {
        setSubjects(apiSubjects.map(apiToSubjectItem));
      }
    } catch {
      // Keep demo subjects on offline
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

  const filtered = subjects.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Header onMenu={onOpenMenu} onProfile={onOpenProfile} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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

        {/* Subjects List */}
        <View style={styles.subjectsList}>
          {filtered.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              onPress={() => onSelectSubject(subject)}
              onOptionsPress={() => {}}
            />
          ))}
          {filtered.length === 0 && !isLoading && (
            <Text style={styles.emptyText}>No subjects found. Add one above!</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 32 },
  libraryTitle: { fontFamily: typography.serifBold, fontSize: 34, color: colors.textPrimary, marginBottom: 24, letterSpacing: -0.5 },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderMedium, paddingBottom: 8, gap: 10, marginBottom: 28 },
  searchInput: { flex: 1, fontFamily: typography.sansRegular, fontSize: 16, color: colors.textPrimary, paddingVertical: 2 },
  addSubjectCard: { height: 64, borderRadius: 12, borderWidth: 1, borderColor: colors.borderMedium, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFBF8', marginBottom: 36 },
  addSubjectText: { fontFamily: typography.sansMedium, fontSize: 15, color: colors.brandGreen },
  addSubjectForm: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight, padding: 16, marginBottom: 28, gap: 12 },
  addSubjectInput: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.textPrimary, borderBottomWidth: 1, borderBottomColor: colors.borderMedium, paddingBottom: 8 },
  addSubjectButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.borderMedium },
  cancelBtnText: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.textMuted },
  confirmBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.brandGreen },
  confirmBtnText: { fontFamily: typography.sansMedium, fontSize: 14, color: '#FFFFFF' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionOverline: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.5 },
  subjectsList: { gap: 4 },
  cardPressed: { opacity: 0.75 },
  emptyText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 32 },
});
