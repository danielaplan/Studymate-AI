import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { colors, typography } from '../theme';
import { MenuIcon, BackIcon, CloseIcon } from './Icons';

const DEFAULT_PROFILE_IMG = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80';

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
}: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
        {showBack ? (
          <Pressable
            accessibilityLabel="Go back"
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <BackIcon size={20} color={colors.brandGreen} />
          </Pressable>
        ) : showClose ? (
          <Pressable
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <CloseIcon size={20} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Open navigation menu"
            onPress={onMenu}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <MenuIcon size={20} color={colors.brandGreen} />
          </Pressable>
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
            style={({ pressed }) => [styles.profileWrapper, pressed && styles.pressed]}
          >
            <Image source={{ uri: DEFAULT_PROFILE_IMG }} style={styles.profileAvatar} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(223, 227, 218, 0.5)',
  },
  leftContainer: {
    width: 40,
    alignItems: 'flex-start',
  },
  rightContainer: {
    width: 60,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
  },
  brandTitle: {
    color: colors.brandGreen,
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  profileWrapper: {
    borderRadius: 16,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(195, 200, 189, 0.5)',
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
    opacity: 0.6,
  },
});
