import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';
import { FolderIcon, DocumentIcon, EditIcon, TrashIcon, LayersIcon } from './Icons';

interface ChatContextMenuProps {
  visible: boolean;
  onClose: () => void;
  // Context-menu actions (handlers live in the host screen / App.tsx — this
  // component is purely presentational). Every entry is OPTIONAL: the sheet
  // only shows the rows the host provides. The menu ACTS on the current subject
  // (switch / new / rename / delete / scroll to sources) — it is never a back
  // control; that's the Back button's job (see SubjectWorkspaceScreen).
  onSwitchSubject?: () => void;
  onNewChat: () => void;
  onManageSources?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

/**
 * Dependency-light bottom-sheet shown when the subject tile (▼) is tapped in the
 * Subject Workspace. A single custom Modal path covers iOS / Android / web (no
 * ActionSheetIOS fragmentation, no new native deps). Replaces the old
 * "tap tile → jump to picker" behavior — the tile is now a workspace menu, not a
 * navigation control (CHANGES.md §8c, Subject Workspace merge 2026-08-30).
 */
export function ChatContextMenu({
  visible,
  onClose,
  onSwitchSubject,
  onNewChat,
  onManageSources,
  onRename,
  onDelete,
}: ChatContextMenuProps) {
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Backdrop hit area — tapping it closes the sheet. The sheet itself sits
            above this layer and is NOT a child of it, so taps on the sheet
            don't bubble into the close handler. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Subject options</Text>
          {onSwitchSubject && (
            <MenuItem
              icon={<FolderIcon size={18} color={colors.brandGreen} />}
              label="Switch subject"
              onPress={run(onSwitchSubject)}
            />
          )}
          <MenuItem
            icon={<DocumentIcon size={18} color={colors.brandGreen} />}
            label="New chat"
            onPress={run(onNewChat)}
          />
          {onManageSources && (
            <MenuItem
              icon={<LayersIcon size={18} color={colors.brandGreen} />}
              label="Manage sources"
              onPress={run(onManageSources)}
            />
          )}
          {onRename && (
            <MenuItem
              icon={<EditIcon size={18} color={colors.brandGreen} />}
              label="Rename subject"
              onPress={run(onRename)}
            />
          )}
          {onDelete && (
            <MenuItem
              icon={<TrashIcon size={18} color={colors.error} />}
              label="Delete subject"
              labelColor={colors.error}
              onPress={run(onDelete)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  labelColor,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  labelColor?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View style={styles.itemIcon}>{icon}</View>
      <Text style={[styles.itemLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMedium,
    marginBottom: 12,
  },
  title: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginLeft: 4,
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  itemPressed: { backgroundColor: colors.surfaceMuted },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
