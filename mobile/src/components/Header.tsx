import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography } from '../theme';
import { MenuIcon, BackIcon, CloseIcon } from './Icons';
import { Monogram } from './Monogram';
import { IconButton } from './IconButton';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showClose?: boolean;
  onBack?: () => void;
  onMenu?: () => void;
  onClose?: () => void;
  onProfile?: () => void;
  rightActionText?: string;
  onRightAction?: () => void;
  // When a screen renders its own local back row above a subject tile (the
  // pushed-screen pattern), the global header's left icon is hidden so the two
  // backs don't collide. Profile stays on the right.
  hideLeft?: boolean;
}

export function Header({
  title = 'STUDYMATE',
  showBack = false,
  showClose = false,
  onBack,
  onMenu,
  onClose,
  onProfile,
  rightActionText,
  onRightAction,
  hideLeft = false,
}: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
        {hideLeft ? null : showBack ? (
          <IconButton
            accessibilityLabel="Go back"
            onPress={onBack}
            icon={<BackIcon size={20} color={colors.brandGreen} />}
          />
        ) : showClose ? (
          <IconButton
            accessibilityLabel="Close"
            onPress={onClose}
            icon={<CloseIcon size={20} color={colors.textPrimary} />}
          />
        ) : (
          <IconButton
            accessibilityLabel="Open navigation menu"
            onPress={onMenu}
            icon={<MenuIcon size={20} color={colors.brandGreen} />}
          />
        )}
      </View>

      <Text style={styles.brandTitle}>{title}</Text>

      <View style={styles.rightContainer}>
        {rightActionText ? (
          <Pressable
            accessibilityLabel={rightActionText}
            onPress={onRightAction}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.rightActionText}>{rightActionText}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="User Profile"
            onPress={onProfile}
            hitSlop={{ top: 6, left: 6, right: 6, bottom: 6 }}
            style={({ pressed }) => [styles.profileWrapper, pressed && styles.pressed]}
          >
            <Monogram size={32} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  leftContainer: {
    width: 44,
    alignItems: 'flex-start',
  },
  rightContainer: {
    width: 44,
    alignItems: 'flex-end',
  },
  brandTitle: {
    color: colors.brandGreen,
    fontFamily: typography.display,
    fontSize: 15,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  profileWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  textButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  rightActionText: {
    color: colors.textSecondary,
    fontFamily: typography.sansMedium,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
