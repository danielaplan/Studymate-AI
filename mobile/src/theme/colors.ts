export const colors = {
  // Core surfaces
  background: '#F6F4EE',
  backgroundAlt: '#F2F0EA',
  surface: '#FFFFFF',
  surfaceElevated: '#F9F7F3',
  surfaceMuted: '#F0EFEA',

  // Premium neutral palette
  ink: '#1B1D1A',
  inkSoft: '#2E332F',
  muted: '#5E625B',
  mutedSoft: '#7E827A',
  line: '#E7E4DD',
  lineStrong: '#D9D4CC',

  // Brand accents
  brandGreen: '#243C2C',
  brandGreenDark: '#1A2C21',
  brandGreenLight: '#5C7B62',
  brandGreenSoft: '#DDE8DD',
  sageBadge: '#E9F0E7',
  sageBadgeText: '#2A3D2B',

  // Highest-emphasis CTA (onboarding Continue, pickers, empty-state). Documented
  // as `primary-ink` in DESIGN.md; previously hard-coded as #1E221D in several
  // screens, which drifted from brandGreenDark. Centralize it here.
  inkButton: '#1E221D',

  // A single, sparingly-used alert color for BLOCKING states only (failed
  // upload, offline, still-indexing when an action depends on it). The system is
  // deliberately quiet; this must never be used decoratively.
  alert: '#B23A3A',

  // Soft variants of the canonical status tokens (defined in the Status & tags
  // block below). Quiz correct/incorrect/partial feedback routes through
  // success/error/warning; these soft tints back the badges and wrong-option rows
  // so the palette stays disciplined. Previously hard-coded literals in
  // QuizOverview.
  errorSoft: '#F7DED6',
  errorText: '#9A3A22',
  // Border tint for the light-red error surfaces (consolidates the three
  // near-identical #F3C9C9 / #EBC6C0 borders that used to drift across
  // HomeScreen / GuidedCaptureThread / SubjectsScreen).
  errorBorder: '#EBC6C0',

  // Tab colors. The old blue activeTabPill/activeTabText tokens violated the One
  // Accent Rule (a second accent) and were never referenced — removed during the
  // native-conformance audit.
  inactiveTab: '#5F645F',

  // Text
  textPrimary: '#1C1F1C',
  textSecondary: '#3E443F',
  textMuted: '#727772',
  // Placeholder text. Was #9A9E97 (~2.3:1) — below the WCAG AA 4.5:1 floor on
  // white. Darkened to a calm green-gray that meets AA while staying quiet.
  textPlaceholder: '#6B716A',

  // Border & divider
  borderLight: '#EEEAE1',
  borderMedium: '#DFD9D0',
  borderDark: '#CBC3B7',
  divider: '#E9E5DE',

  // Artifact card palette (AIArtifactCard + suggestion chips). Distinct from the
  // brand-green chat palette so saved study artifacts read as "your notes", not
  // chat lines. Values pinned by the artifact redesign spec.
  artifact: {
    cardBg: '#FBFAF6',
    border: '#E7E4D9',
    tagBg: '#E4EBE6',
    tagText: '#1B3A2E',
    ink: '#1B3A2E',
    inkSoft: '#5B6B62',
    forestTint: '#E4EBE6',
    forest: '#1B3A2E',
  },

  // Status & tags
  success: '#2A4A36',
  error: '#B23A3A',
  warning: '#9B6C2F',
  chipBg: '#F4F1EB',
};
