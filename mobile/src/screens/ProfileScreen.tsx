import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { colors, typography } from '../theme';
import { Header } from '../components/Header';
import { Monogram } from '../components/Monogram';
import { ContentContainer } from '../components/ContentContainer';
import { SettingsIcon, ShieldIcon, ChevronRightIcon } from '../components/Icons';

interface ProfileScreenProps {
  onOpenMenu: () => void;
}

export function ProfileScreen({ onOpenMenu }: ProfileScreenProps) {
  return (
    <View style={styles.container}>
      {/* The header's avatar tap is a no-op here (we're already on Profile) —
          pass an onProfile that does nothing rather than leaving it undefined
          so the control stays honest: it looks tappable because it is the
          profile context itself. */}
      <Header onMenu={onOpenMenu} onProfile={() => {}} />

      <ContentContainer style={styles.contentWrap}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* User Identity Card — no photo, no hardcoded identity. The monogram is
            generic; a real name would come from authenticated storage. */}
        <View style={styles.identitySection}>
          <Monogram size={96} />
          <Text style={styles.userName}>Your Profile</Text>
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
      </ContentContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentWrap: {
    flex: 1,
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
  userName: {
    fontFamily: typography.serifBold,
    fontSize: 32,
    color: colors.textPrimary,
    marginTop: 16,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
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
