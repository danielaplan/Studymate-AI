import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, Alert } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { SettingsIcon, ShieldIcon, ChevronRightIcon } from '../components/Icons';

interface ProfileScreenProps {
  onOpenMenu: () => void;
}

const PROFILE_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';

export function ProfileScreen({ onOpenMenu }: ProfileScreenProps) {
  return (
    <View style={styles.container}>
      {/* The header's avatar tap is a no-op here (we're already on Profile) —
          pass an onProfile that does nothing rather than leaving it undefined
          so the control stays honest: it looks tappable because it is the
          profile context itself. */}
      <Header onMenu={onOpenMenu} onProfile={() => {}} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Identity Card */}
        <View style={styles.identitySection}>
          <Image source={{ uri: PROFILE_AVATAR }} style={styles.avatarImage} />
          <Text style={styles.userName}>Alex Rivera</Text>
          <Text style={styles.userEmail}>a.rivera@university.edu</Text>
        </View>

        <View style={styles.divider} />

        {/* Intelligence & Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionOverline}>INTELLIGENCE &amp; PRIVACY</Text>

          {/* AI Settings Row — honest about there being no settings screen yet
              (BYOK auth is a pending backlog item). A tap that does nothing is
              worse than a clear "coming soon". */}
          <Pressable
            accessibilityLabel="AI Settings"
            onPress={() => Alert.alert('AI Settings', 'Personal AI settings (bring your own OpenRouter key) are coming soon.')}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
          >
            <View style={styles.settingsLeft}>
              <View style={styles.iconContainer}>
                <SettingsIcon size={20} color={colors.brandGreen} />
              </View>
              <View>
                <Text style={styles.settingsTitle}>AI Settings</Text>
                <Text style={styles.settingsSubtitle}>• Local AI Ready</Text>
              </View>
            </View>
            <ChevronRightIcon size={18} color={colors.textMuted} />
          </Pressable>

          {/* Local Processing Guarantee Card */}
          <View style={styles.privacyCard}>
            <View style={styles.privacyHeaderRow}>
              <ShieldIcon size={22} color={colors.brandGreen} />
              <Text style={styles.privacyCardTitle}>Local Processing Active</Text>
            </View>
            <Text style={styles.privacyCardBody}>
              To ensure maximum privacy and reduce digital fatigue, all document analysis and study generation occurs directly on your device. Your data never leaves this hardware.
            </Text>
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
    paddingTop: 36,
    paddingBottom: 40,
  },
  identitySection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  userName: {
    fontFamily: typography.serifBold,
    fontSize: 32,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: 28,
  },
  section: {
    gap: 16,
  },
  sectionOverline: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sageBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitle: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  settingsSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.brandGreen,
    marginTop: 2,
  },
  privacyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 20,
    gap: 12,
  },
  privacyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  privacyCardTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  privacyCardBody: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  rowPressed: {
    opacity: 0.75,
  },
});
