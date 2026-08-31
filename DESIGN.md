---
name: StudyMate AI
description: A quiet, grounded study companion — paper-warm surfaces, deep forest green, Playfair + Inter.
colors:
  primary: "#243C2C"
  primary-dark: "#1A2C21"
  primary-ink: "#1E221D"
  primary-soft: "#DDE8DD"
  neutral-bg: "#F6F4EE"
  neutral-bg-alt: "#F2F0EA"
  surface: "#FFFFFF"
  surface-elevated: "#F9F7F3"
  surface-muted: "#F0EFEA"
  ink: "#1B1D1A"
  text-primary: "#1C1F1C"
  text-secondary: "#3E443F"
  text-muted: "#727772"
  line: "#E7E4DD"
  line-strong: "#D9D4CC"
  border-light: "#EEEAE1"
  border-medium: "#DFD9D0"
  border-dark: "#CBC3B7"
  success: "#2A4A36"
  error: "#B23A3A"
  warning: "#9B6C2F"
  forest-artifact: "#1B3A2E"
  artifact-card-bg: "#FBFAF6"
  artifact-tag-bg: "#E4EBE6"
  sage-badge: "#E9F0E7"
  chip-bg: "#F4F1EB"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.4px"
  body:
    fontFamily: "Inter, System, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, System, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "1px"
    textTransform: "uppercase"
rounded:
  sm: "10px"
  md: "16px"
  lg: "18px"
  xl: "22px"
  xxl: "30px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  card-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px 18px"
  chip-tag:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    typography: "{typography.label}"
---

# Design System: StudyMate AI

## Overview

**Creative North Star: "The Quiet Tutor's Library"**

StudyMate AI is a grounded study companion, and its visual world should feel like a calm, well-kept library belonging to a tutor you trust — quiet, paper-warm, and free of noise so the learner's attention stays on the material. The product's job is comprehension (not gamification), so the interface is deliberately understated: deep forest green as the single voice of intelligence and action, warm off-white paper as the ground, and Playfair Display lending a studious, editorial dignity to titles and the hero mastery number. Everything functional runs on Inter, kept small, muted, and out of the way.

The system is **refined and restrained**, not tactile or expressive. Depth is implied, never announced: hairline borders define surfaces and very soft shadows appear only when something genuinely floats. Motion is subtle and purposeful (a spring on swipe, a count-up on mastery) and always yields to the OS Reduce-Motion setting.

**Key Characteristics:**
- Paper-warm neutral ground (`#F6F4EE`) with white and faintly green-tinted surfaces; depth via hairline borders, not heavy shadow.
- One accent — deep forest green (`#243C2C`) — for brand, intelligence, and primary action; used sparingly. A deeper near-black green (`#1E221D`) is the highest-emphasis CTA shade (onboarding, empty states, pickers).
- Playfair Display for titles, leads, the hero %, and single statement words (flashcard terms, deck titles); Inter for all functional type. Numeric stats (mastery %, metric pills) also render in Playfair.
- A second, forest-tinted "notes" language (`colors.artifact`) that visually separates saved study artifacts from live chat.
- Illustration is abstract, geometric, green-family SVG art (onboarding hero) — calm and non-photographic; no stock imagery.
- Native-first: one shared theme ships iOS + Android (+ web), honoring each platform's navigation, safe-area, and touch-target rules.

## Colors

A warm, low-chroma palette. The brand green is the only true accent; everything else is paper, ink, or hairline. The `artifact` family is a deliberate secondary language for saved study material.

### Primary
- **Forest Green** (`#243C2C`): the single brand/intelligence/action voice — app bar title, active nav, selected quiz option, mastery ring fill, primary buttons, AI eyebrow labels. Its rarity is the point.
- **Forest Green Deep** (`#1A2C21`): pressed/hover/active state of the primary, and active nav text.
- **Forest Green Ink** (`#1E221D`): the deepest, near-black green — highest-emphasis CTA fill on onboarding "Continue", flashcards empty-state, and the chat subject picker. Distinct from `primary`; use it only for full-bleed primary CTAs, not inline actions.
- **Forest Green Soft** (`#DDE8DD`): the tint behind active nav icons and selected surfaces — the gentlest expression of the accent.

### Secondary
- **Artifact Forest** (`#1B3A2E`) and the `artifact` family (`artifact-card-bg #FBFAF6`, `artifact-tag-bg #E4EBE6`): a distinct, cooler green-and-paper language for AI-generated summaries/quizzes/flashcards. Keeps saved "your notes" visually separate from the brand-green chat stream.

### Neutral
- **Paper** (`#F6F4EE`): app background; warmer sibling `neutral-bg-alt #F2F0EA` for alternating bands.
- **Surface** (`#FFFFFF`), **Surface Elevated** (`#F9F7F3`), **Surface Muted** (`#F0EFEA`): cards, sheets, and inset regions.
- **Ink** (`#1B1D1A`) / **Text Primary** (`#1C1F1C`): headings and body. **Text Secondary** (`#3E443F`) for supporting copy; **Text Muted** (`#727772`) for metadata, captions, placeholders.
- **Line** (`#E7E4DD`) / **Line Strong** (`#D9D4CC`): hairline borders and dividers that do most of the depth work. Border steps: `border-light #EEEAE1` (card edges), `border-medium #DFD9D0`, `border-dark #CBC3B7` (radio outlines).
- **Sage Badge** (`#E9F0E7`) with `sageBadgeText #2A3D2B` (a legacy warm-green pill for pinned badges); **Chip BG** (`#F4F1EB`) for neutral chips.

### Status
- **Success** (`#2A4A36`), **Error** (`#B23A3A`), **Warning** (`#9B6C2F`) — used sparingly for processing/validation states.

### Named Rules
**The One Accent Rule.** Forest green is the only chromatic voice for brand and action; it should read on a small fraction of any screen (app-bar title, active nav, one primary button, the mastery ring). Its restraint is what makes it feel like a trusted tutor, not a dashboard.

**The Two-Language Rule.** The live chat thread uses white bubbles with a 3px forest-green left rule and a "STUDYMATE AI" green eyebrow; the user's own messages are the solid green bubble. Saved study artifacts (`AIArtifactCard`) use the cooler `artifact` forest-and-paper language so "your notes" never read as a throwaway chat line.

## Typography

**Display Font:** Playfair Display (with Georgia/serif fallback)
**Body Font:** Inter (with System fallback)
**Label/Mono Font:** Inter (uppercase, tracked) for eyebrows, tags, and overlines.

**Character:** Playfair brings a studious, editorial calm to moments that deserve dignity (screen titles, the hero mastery %, artifact leads in italic); Inter does the quiet, legible work everywhere else. The contrast — serif display against a humanist sans — is the system's signature, not decoration.

### Hierarchy
- **Display** (Playfair 600, ~22px titles; 28–36px hero/onboarding; line-height ~1.15; slight negative tracking): screen and subject titles, big onboarding/empty-state heads, deck title (32px), picker title (28px).
- **Hero numeral** (Playfair 700, 22px, tabular-nums): the mastery % at the center of `MasteryRing`.
- **Lead** (Playfair 400 *italic*, 16px / 23): the one-line serif lead inside `AIArtifactCard` (a substitute for the spec's "Lora italic"; Lora is not loaded).
- **Title** (Inter 600, 13.5–15px): card headlines, suggestion topics, list row names.
- **Body** (Inter 400, 13–15px / 21–24): chat replies (15/24), artifact body (13/21), general copy.
- **Label** (Inter 600, 10–11px, letter-spacing 1–1.5px, uppercase): eyebrows ("STUDYMATE AI", "AI SUGGESTION"), tags, nav labels (11.5px), material tags, field labels.

### Named Rules
**The Serif-Moment Rule.** Playfair appears only at titles, the hero %, stat numerals (mastery %, metric pills), statement words (flashcard terms, deck titles), and artifact leads — never for body or UI controls. If it's not a heading, a numeral, or a lead, it's Inter.

**The Quiet Scale Rule.** Functional sizes cluster tightly (10/11/12/13/14/15); only display moments jump to 22–36px. Don't introduce a third size band between "label" and "title" — keep the ladder calm.

## Layout

Portrait-first, single-column, generous whitespace. Screens are stacked scrolls under a 62px app bar and above an 82px floating bottom nav, with 18px horizontal screen padding. Content is centered in a comfortable reading measure; chat and workspace screens relax that for full-width bubbles.

**Native (iOS + Android) constraints — the shared theme must honor both:**
- **Safe area / insets:** lay out inside safe-area insets; never place controls under the notch, Dynamic Island, home indicator, or status bar. Bottom nav already floats above the home indicator.
- **System navigation:** tab bar for the 3 top-level sections (Home / Subjects / Profile); push-navigation stack for detail; sheets for self-contained tasks. Keep the OS edge-swipe-back alive (`EdgeBack` is wired; `app.json` sets `predictiveBackGestureEnabled: false` on Android — revisit so the system Back gesture is never trapped).
- **Touch targets:** aim for ≥44pt (iOS HIG) / 48dp (Material 3). Current 32×32 icon buttons are a known tight spot to revisit; the bottom-nav tab min-width (64) and `Pressable` rows clear the floor.
- **Type follows the system:** the incumbent hard-codes sizes; future work should honor Dynamic Type (iOS) / font-scale (Android) so large-type users don't get truncated heads.

## Elevation & Depth

This system is **flat at rest and lifts only on float**. Surfaces are defined primarily by 1px hairline borders (`line` / `border-light`); shadows are extremely soft (opacity 0.04–0.08, large radius, slight downward offset) and appear only on elevated or floating elements — the bottom nav (`elevation: 8`, top-rounded, translucent white), the subject card's pinned state, and sheets. Pressed states use a simple opacity fade (0.7–0.82), not a shadow jump. Depth is felt, not seen.

### Shadow Vocabulary
- **Hairline rest** (`borderWidth: 1, borderColor: line` / `border-light`): default surface definition for cards and inputs.
- **Float** (`shadowColor #000, opacity 0.06, radius 12, offset {0,-4}, elevation 8`): the floating bottom nav and elevated sheets.
- **Card rest** (`opacity 0.04, radius 12, offset {0,6}, elevation 2`): subject cards at rest.
- **Pinned lift** (`shadowColor #243C2C, opacity 0.08`): a subject card marked pinned.

### Named Rules
**The Hairline-Before-Shadow Rule.** Reach for a 1px border before a shadow. Shadows are reserved for things that genuinely float (nav, sheets); static cards earn a border, not a drop shadow.

## Shapes

A soft, rounded, paper form language. Corners are generous but never pill except for true chips and badges.

- **Pills (999px):** tags, badges, active-nav icon pills, swipe "More" hint, suggestion chips, setup chips.
- **Floating nav (22px top corners):** the bottom nav's top edge is rounded into the content above it.
- **Feature cards (22px):** the Study-pulse "hero" card, Continue-Studying card — a deliberate large radius that signals a primary surface.
- **Cards (18px):** subject cards and most list containers.
- **Illustration card (30px):** the onboarding hero art card — the single oversized radius in the system, reserved for illustration.
- **Artifact / inputs (16px):** `AIArtifactCard`, chat text input, flashcard face.
- **Options (12px):** quiz option rows, prompt chips.
- **Icon buttons / action chips (10px):** header icon buttons, artifact action buttons, option "more" buttons.
- **Radio dots (11px):** quiz option selection circles.
- **Borders:** 1px hairline everywhere; `border-dark` only on interactive radio outlines.

### Named Rules
**The Warm Corner Rule.** Keep radii in the 10→22px band for content; the system reads as paper, not glass. The 30px illustration card is the sole oversized exception, reserved for the onboarding hero art. Avoid sharp 0px corners on surfaces.

## Components

### Buttons
- **Shape:** 16px radius (10px for compact icon/text buttons).
- **Primary:** forest-green fill (`#243C2C`), paper text, uppercase tracked Inter label, padding ~14×20. Hover/press → `primary-dark` with a slight opacity fade.
- **Secondary / Ghost:** bordered pill or text button (header "right action", artifact "Save/Regenerate"); forest or ink text on transparent/soft-tint, no fill.
- **Disabled:** opacity 0.4, no fill shift.

### Chips & Tags
- **Style:** pill (999px), `primary-soft` tint with forest text for active/brand tags; `chip-bg` for neutral. Uppercase tracked Inter label (10–11px).
- **State:** selected = forest tint; unselected = neutral chip. Used for material tags, suggestion chips, artifact type tags ("SUMMARY / QUIZ / FLASHCARDS").

### Cards / Containers
- **Corner Style:** 18px (subject), 16px (artifact/input), 12px (quiz option).
- **Background:** `surface` white or `surface-elevated`/`#F9F8F4` warm; artifact cards use `artifact-card-bg #FBFAF6`.
- **Border:** 1px hairline (`border-light` at rest, `border-dark` on radio outlines, `border-medium` on pinned).
- **Internal Padding:** 16–18px horizontal, 18px vertical for subject cards; 16px for artifact cards.
- **Shadow Strategy:** see Elevation — hairline at rest, soft float only on pinned/elevated.

### Inputs / Fields
- **Style:** transparent within a 16px-rounded field, 1px hairline, Inter 15px body. Chat input uses `border-light` and a 16px radius.
- **Focus:** subtle — border stays; the composer is a calm bar, not a glowing field.
- **Error / Disabled:** error red (`#B23A3A`) for validation; disabled controls fade to 0.4.

### Navigation
- **Bottom nav:** floating, 82px tall, translucent white (0.84 alpha), 1px top hairline + 22px top-rounded corners, soft upward shadow. Three equal tabs (Home / Subjects / Profile); active tab gets a `primary-soft` icon pill and forest text; inactive text is muted (`#5F645F`). Icons are 20px, stroke 1.8.
- **App bar (Header):** 62px, translucent white, 1px bottom hairline. Left = menu / back / close (32px icon button, 10px radius); center = "STUDYMATE" wordmark in Playfair 15px, letter-spacing 2.4, uppercase, forest; right = profile avatar (32px circle) or a text action.
- **Back:** respects OS edge-swipe (`EdgeBack`); Android `predictiveBackGestureEnabled: false` is a known deviation to revisit.

### Chat
- **Two-bubble system (the Two-Language Rule in practice):** the AI bubble is a white `#FFFFFF` surface with a 1px `border-light` hairline and a 3px forest-green (`#243C2C`) left rule; a tracked uppercase "STUDYMATE AI" eyebrow (green) sits above the Playfair-italic-free Inter reply (15px/24). The user's own message is the solid forest-green bubble (`#243C2C`), white text, radius 20 with an asymmetric 4px bottom-right corner, and a soft shadow. Bubbles are 20px-rounded; the composer is a white 16px-rounded bar with paperclip (mint), mic (muted), and a 40px green circular send.
- **Setup / suggestion chips:** pill chips (999px) that prime the first question.

### Signature Components
- **AIArtifactCard** — the saved-study-material card: a forest-tinted "your notes" surface (`artifact-cardBg`, 16px radius, 1px `artifact.border`) with an uppercase "STUDYMATE AI" eyebrow, a single-line type tag pill, a Playfair-italic lead, an Inter body, an expandable details block, a copy/save/regenerate action row, and an optional "Open full →" CTA. Has a no-reflow loading skeleton. This is the component that most defines the incumbent system — preserve its two-language separation.
- **MasteryRing** — the hero mastery meter: an SVG track + forest fill arc (stroke 9, round cap) that draws in over ~1s while the center % counts up in Playfair tabular-nums; rotates to start at 12 o'clock; honors OS Reduce Motion (snaps instead of animates). Center numeral 22px Playfair 700.
- **Onboarding Illustration** — the one decorative signature: an abstract, non-photographic SVG of calm geometric green shapes (`#EEF7EA` / `#D6E5CF` / `#8DA989` / `#5A7556`) sitting in a 30px-radius paper card with a soft shadow and a faint outer glow. It carries the brand's "quiet tutor's library" calm; never replace with stock imagery.
- **FlashcardItem** — the study card face: a white 16px-radius surface (min-height 340), the term in Playfair serifBold 32px centered, the definition in Inter 18px, a tracked uppercase side label; reveal (conceptual cross-fade, not a 3D flip) shifts the background to `#FAFBF8` and adds a `brandGreenLight` border. Nav buttons are 24px-radius bordered pills.

## Do's and Don'ts

### Do:
- **Do** keep forest green rare — brand, active nav, one primary action, the mastery ring. Let paper and ink carry the rest.
- **Do** use Playfair only for titles, the hero %, stat numerals, statement words, and artifact leads; everything functional is Inter.
- **Do** define surfaces with a 1px hairline before reaching for a shadow; shadows only on floating nav/sheets.
- **Do** keep radii in the 10–22px paper band; use 999px only for true pills/badges.
- **Do** preserve the chat-vs-artifact two-language split so saved notes never look like a chat line.
- **Do** honor safe-area insets and keep the OS edge-swipe-back alive on both platforms.

### Don't:
- **Don't** introduce a third type-size band between label (10–11) and title (13–15); keep the quiet ladder.
- **Don't** add a second chromatic accent — no blue/red/orange brand colors beyond the existing status greens/reds/ambers.
- **Don't** ship hard drop shadows on static cards; their depth is the hairline border.
- **Don't** trap the system Back gesture on Android (the `predictiveBackGestureEnabled: false` setting is a known deviation).
- **Don't** shrink tappable controls below 44pt (iOS) / 48dp (Android); revisit the 32px icon buttons.
