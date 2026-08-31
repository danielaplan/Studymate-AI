import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, typography } from '../theme';
import { DocumentIcon, ChevronDownIcon } from './Icons';
import { listMaterials, MaterialAPI } from '../api/client';

interface SourcesPanelProps {
  subjectId: number;
  // The set of materials currently grounding the chat. Tapping a row toggles
  // membership in this set (NotebookLM-style source selection).
  activeIds: number[];
  onToggle: (id: number) => void;
  // The panel now defaults to OPEN — with the chat off the page, the full source
  // list + active toggles can fill the space. The header always shows the
  // active count.
  defaultCollapsed?: boolean;
}

// Collapsible panel of a subject's study materials, each with an active-source
// toggle. Replaces the old `onOpenMaterial` navigation: in the Subject Workspace
// a file is no longer a link to a separate screen — it's a source the chat is
// grounded on. Files still processing can't be activated yet.
export function SourcesPanel({
  subjectId,
  activeIds,
  onToggle,
  defaultCollapsed = false,
}: SourcesPanelProps) {
  const [materials, setMaterials] = useState<MaterialAPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listMaterials(subjectId)
      .then((data) => {
        if (!cancelled) {
          setMaterials(data);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Could not load materials.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const activeCount = materials.filter((m) => activeIds.includes(m.id)).length;

  const handleToggle = (m: MaterialAPI) => {
    if (m.processing_status !== 'done') return; // can't scope to an unprocessed file
    onToggle(m.id);
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={collapsed ? 'Expand sources' : 'Collapse sources'}
        onPress={() => setCollapsed((c) => !c)}
        style={({ pressed }) => [styles.headerRow, pressed && styles.headerPressed]}
      >
        <Text style={styles.overline}>
          SOURCES{!isLoading ? `  ·  ${activeCount}/${materials.length} active` : ''}
        </Text>
        <View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}>
          <ChevronDownIcon size={16} color={colors.textMuted} />
        </View>
      </Pressable>
      <Text style={styles.hint}>Toggle a source on to ground your chat in those notes.</Text>

      {!collapsed && (
        <View style={styles.list}>
          {error && <Text style={styles.errorText}>{error}</Text>}

          {isLoading && materials.length === 0 && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.brandGreen} />
              <Text style={styles.loadingText}>Loading sources…</Text>
            </View>
          )}

          {!isLoading && materials.length === 0 && !error && (
            <Text style={styles.emptyText}>No study materials yet. Upload notes to add sources.</Text>
          )}

          {materials.map((m) => {
            const active = activeIds.includes(m.id);
            const processing = m.processing_status !== 'done';
            return (
              <Pressable
                key={m.id}
                disabled={processing}
                accessibilityRole="switch"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${active ? 'Active' : 'Inactive'} source ${m.filename}`}
                onPress={() => handleToggle(m)}
                style={({ pressed }) => [
                  styles.row,
                  active && styles.rowActive,
                  pressed && !processing && styles.rowPressed,
                ]}
              >
                <View style={styles.docBadge}>
                  <DocumentIcon size={16} color={colors.brandGreen} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {m.filename}
                  </Text>
                  <Text style={styles.meta}>
                    {processing
                      ? 'Processing…'
                      : `${m.file_type.toUpperCase()} · ${m.chunks_count} chunks`}
                  </Text>
                </View>
                <View style={[styles.toggle, active ? styles.toggleOn : styles.toggleOff]}>
                  {active && <Text style={styles.check}>✓</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9F7F2',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerPressed: { opacity: 0.7 },
  overline: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  hint: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  list: { marginTop: 10, gap: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted },
  emptyText: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.textMuted, paddingVertical: 6 },
  errorText: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.error, paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rowActive: { borderColor: colors.brandGreenLight, backgroundColor: colors.brandGreenSoft },
  rowPressed: { opacity: 0.75 },
  docBadge: {
    width: 30,
    height: 34,
    backgroundColor: colors.sageBadge,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  title: { fontFamily: typography.sansMedium, fontSize: 14, color: colors.textPrimary },
  meta: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.textMuted },
  toggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  toggleOn: { backgroundColor: colors.brandGreen, borderColor: colors.brandGreen },
  toggleOff: { backgroundColor: 'transparent', borderColor: colors.borderMedium },
  check: { color: colors.surface, fontFamily: typography.sansBold, fontSize: 14, lineHeight: 16 },
});
