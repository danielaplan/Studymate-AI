import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography } from '../theme';
import { TabName } from '../types';
import { HomeNavIcon, SubjectsNavIcon, ChatNavIcon, ProfileNavIcon } from './Icons';

interface BottomNavProps {
  currentTab: TabName;
  onSelectTab: (tab: TabName) => void;
}

export function BottomNav({ currentTab, onSelectTab }: BottomNavProps) {
  const tabs: { key: TabName; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
      key: 'home',
      label: 'Home',
      icon: (active) => <HomeNavIcon size={20} color={active ? colors.brandGreenDark : colors.inactiveTab} />,
    },
    {
      key: 'subjects',
      label: 'Subjects',
      icon: (active) => <SubjectsNavIcon size={20} color={active ? colors.brandGreenDark : colors.inactiveTab} />,
    },
    {
      key: 'chat',
      label: 'Chat',
      icon: (active) => <ChatNavIcon size={20} color={active ? colors.brandGreenDark : colors.inactiveTab} />,
    },
    {
      key: 'profile',
      label: 'Profile',
      icon: (active) => <ProfileNavIcon size={20} color={active ? colors.brandGreenDark : colors.inactiveTab} />,
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
    height: 78,
    backgroundColor: 'rgba(250, 250, 244, 0.98)',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  iconPill: {
    width: 60,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeIconPill: {
    backgroundColor: colors.activeTabPill,
  },
  tabLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.inactiveTab,
  },
  activeTabLabel: {
    color: colors.brandGreenDark,
    fontFamily: typography.sansSemiBold,
  },
});
