---
name: ติ๊กฟ้าช่วยติ๊กฟ้า
description: A high-fidelity, minimalist engagement-exchange platform for verified X.com creators.
colors:
  primary: "#1d9bf0"
  neutral-bg: "#09090b"
  neutral-surface: "#18181b"
  neutral-ink: "#fafafa"
  neutral-muted: "#a1a1aa"
  border: "#27272a"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(1.75rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  card-container:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "16px"
---

<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->

# Design System: ติ๊กฟ้าช่วยติ๊กฟ้า

## 1. Overview

**Creative North Star: "The Editorial Command Center"**

"ติ๊กฟ้าช่วยติ๊กฟ้า" is designed as a crisp, distraction-free environment that prioritizes content speed, verification utility, and maximum visual focus. We explicitly reject the visual noise of the 2010s web-traffic exchanges, which relied on neon glow buttons, flashy badges, and low-contrast spammy sidebars. 

Instead, the interface feels like a premium news sheet combined with a highly structured terminal: deep charcoal backgrounds, sharp typography, stark white borders, and X-blue accents. Spacing is strictly calculated to maintain high density without clutter, allowing verified creators to navigate their tasks with rapid precision.

**Key Characteristics:**
- Stark editorial contrast with near-black background and white borders.
- Highly functional layout structured around "blocks" or "cards".
- Micro-interactions that emphasize action completion and progress tracking.

---

## 2. Colors

The color palette is highly restrained, using absolute and near-blacks as structural anchors, and X-blue exclusively for primary actions and verification ticks.

### Primary
- **X-Blue** (#1d9bf0): Used strictly for verification badges, primary interaction states (buttons, active status), and critical interactive anchors.

### Neutral
- **Stark Black** (#09090b): The core background canvas.
- **Slate Charcoal** (#18181b): The container card background.
- **Crisp Ink** (#fafafa): Standard body copy and prominent headers.
- **Muted Zinc** (#a1a1aa): Secondary information, timestamps, and metadata.
- **Boundary Border** (#27272a): Sharp, 1px solid dividers defining block grids.

### Named Rules
**The 10% Accent Rule.** The primary blue accent must never cover more than 10% of any single viewport. Its presence indicates high interactive potential (e.g. "Repost now", "Approve registration") and must not be diluted as generic background highlights.

---

## 3. Typography

We pair a classical editorial Serif display font with a high-readability sans-serif body font, creating an atmosphere that feels authoritative yet technically sound.

**Display Font:** Playfair Display, Georgia, serif
**Body Font:** Inter, system-ui, -apple-system, sans-serif

### Hierarchy
- **Display** (Bold 700, clamp(1.75rem, 4vw, 3rem), 1.2): Main headings, dashboard highlights, and brand lede.
- **Headline** (Semi-bold 600, 1.4rem, 1.3): Block section titles, leaderboard headers.
- **Title** (Medium 500, 1.15rem, 1.4): Creator usernames, post content cards.
- **Body** (Regular 400, 0.95rem, 1.5): Standard text block copy, user bios. Cap line length at 70ch.
- **Label** (Medium 500, 0.8rem, 1.2): Timestamps, stats tags, button actions.

### Named Rules
**The Content Hierarchy Rule.** Never pair two sans-serif fonts of similar weight next to each other. The contrast between editorial serif headings and stark sans-serif body content is our primary tool for visual navigation.

---

## 4. Elevation

The system is strictly flat by default to uphold its editorial nature. Depth is conveyed using crisp border lines and contrasting background surfaces rather than soft, diffuse drop shadows.

### Named Rules
**The Flat-Surface Rule.** All cards, menus, and input panels have a zero box-shadow design. Layering is achieved solely via surface shading: card containers are (#18181b) over the base background (#09090b), bounded by 1px borders (#27272a).

---

## 5. Components

Components are styled as solid blocks with zero border-radius decoration above 8px.

### Buttons
- **Shape:** Soft-square (4px border-radius).
- **Primary:** Background (#1d9bf0), Text (#fafafa), bold font, 8px 16px padding.
- **Secondary/Border:** Background (transparent), Border (1px solid #27272a), Text (#fafafa).
- **Hover:** Primary shifts to slightly lighter blue; Secondary background shifts to (#18181b).

### Interaction Cards
- **Shape:** Medium-square (8px border-radius).
- **Style:** Background (#18181b), Border (1px solid #27272a), 16px padding.
- **Active State:** Border shifts to #1d9bf0 if a user has not interacted with it yet.

### Named Rules
**The Interaction Deprioritization Rule.** Active posts appear in a high-priority block queue. Once a user clicks an action button (Repost, Like, etc.) and completes the interaction, the post block gracefully slides down and is deprioritized to the bottom of the list, allowing fresh active posts to rise to the top.

---

## 6. Do's and Don'ts

Strategic guardrails to enforce a professional and highly focused platform.

### Do:
- **Do** use strict 1px solid borders to define component cards and table lists.
- **Do** enforce a maximum 70ch reading line width for post text blocks.
- **Do** move fully interacted post blocks to the bottom of the active queue to keep the creator focus high.

### Don't:
- **Don't** use purple, pink, or generic gradient text anywhere on the platform.
- **Don't** add soft, wide drop shadows (e.g., box-shadow: 0 16px 32px...) to containers.
- **Don't** use side-stripe borders (e.g. border-left: 4px solid #1d9bf0) as accent indicators on list items or cards.
- **Don't** clutter the screen with noisy gamified elements like animated particle badges or progress bars. Keep the layout stark and editorial.
