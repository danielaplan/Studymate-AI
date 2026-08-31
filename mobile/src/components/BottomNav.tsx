import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  IconHome,
  IconNotebook,
  IconUser,
} from '@tabler/icons-react-native';
import { colors, typography } from '../theme';
import { TabName } from '../types';

interface BottomNavProps {
  currentTab: TabName;
  onSelectTab: (tab: TabName) => void;
}

export function BottomNav({ currentTab, onSelectTab }: BottomNavProps) {
  const tabs: {
    key: TabName;
    label: string;
    icon: (active: boolean) => React.ReactNode;
  }[] = [
    {
      key: 'home',
      label: 'Home',
      icon: (active) => <IconHome size={20} color={active ? colors.brandGreenDark : colors.inactiveTab} strokeWidth={1.8} />,
    },
    {
      key: 'subjects',
      label: 'Subjects',
      icon: (active) => <IconNotebook size={20} color={active ? colors.brandGreenDark : colors.inactiveTab} strokeWidth={1.8} />,
    },
    {
      key: 'profile',
      label: 'Profile',
      icon: (active) => <IconUser size={20} color={active ? colors.brandGreenDark : colors.inactiveTab} strokeWidth={1.8} />,
    },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelectTab(tab.key)}
            style={styles.tabItem}
          >
            <View style={[styles.iconPill, isActive && styles.activeIconPill]}>
              {tab.icon(isActive)}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 82,
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  iconPill: {
    width: 58,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeIconPill: {
    backgroundColor: colors.brandGreenSoft,
  },
  tabLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 11.5,
    color: colors.inactiveTab,
    letterSpacing: 0.4,
  },
  activeTabLabel: {
    color: colors.brandGreenDark,
    fontFamily: typography.sansSemiBold,
  },
});
