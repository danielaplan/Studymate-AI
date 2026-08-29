import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';
import { BackIcon, FolderIcon, MoreVerticalIcon } from './Icons';

interface ScreenContextBarProps {
  onBack: () => void;
  // The contextual subject/title shown in the tile below the back row.
  subjectName?: string;
  // Optional second line on the tile (e.g. a chapter or deck name).
  subtitle?: string;
  // When provided, the tile becomes tappable and opens the chat context menu
  // (chat hub only). Omit on screens where the tile is display-only.
  onContextMenu?: () => void;
}

/**
 * The per-screen local back control. Sits in the screen's content, BELOW the
 * global STUDYMATE header, ABOVE the subject/content tile (per the agreed
 * design): a top row with Back on the left and the ⋯ (three-dots) menu trigger
 * right-aligned above the tile, then the subject tile (display-only) below. The ⋯
 * opens the workspace menu (Switch subject / New chat / Rename / Delete / Manage
 * sources). The global header never carries a back button.
 */
export function ScreenContextBar({ onBack, subjectName, subtitle, onContextMenu }: ScreenContextBarProps) {
  const showTile = Boolean(subjectName);
  const switchable = Boolean(onContextMenu);
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={onBack}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
        >
          <BackIcon size={20} color={colors.brandGreen} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        {/* ⋯ (three-dots) menu trigger, right-aligned ABOVE the subject tile so it
            never crowds a long title like "introduction of PHP". */}
        {switchable && (
          <Pressable
            accessibilityLabel="Subject options"
            onPress={onContextMenu}
            style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
          >
            <MoreVerticalIcon size={20} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>

      {showTile && (
        <View style={styles.tile}>
          <View style={styles.tileIcon}>
            <FolderIcon size={18} color={colors.brandGreen} />
          </View>
          <View style={styles.tileInfo}>
            <Text style={styles.tileName} numberOfLines={1}>
              {subjectName}
            </Text>
            {subtitle ? <Text style={styles.tileSub} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  pressed: { opacity: 0.6 },
  backText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.brandGreen,
  },
  menuBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: '#FFFFFF',
  },
  menuBtnPressed: { backgroundColor: colors.surfaceMuted },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileInfo: { flex: 1, gap: 2 },
  tileName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  tileSub: {
    fontFamily: typography.sansRegular,
    fontSize: 12.5,
    color: colors.textMuted,
  },
});
