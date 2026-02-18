# Nexus Hub — Design Plan

**Version:** 1.0
**Date:** 2026-02-18
**Status:** Draft
**References:** `docs/plans/2026-02-18-nexus-hub-design.md`

---

## 1. Design Identity

### Aesthetic Direction: "Dark Scriptorium"

Nexus Hub lives at the intersection of two worlds: the precision of a developer's terminal and the drama of a medieval war room. The aesthetic is **Dark Scriptorium** — a command center for someone who treats their work queue like a battlefield. Dense, information-rich, serious — but with ornate flourishes that signal craft and intention.

This is **not** the generic dark-mode SaaS dashboard. It is closer to a HUD from a gothic fantasy RPG, repurposed for productivity.

### Core Principles

| Principle | Application |
|-----------|-------------|
| **Density over whitespace** | Information is primary. Padding is purposeful, not decorative. |
| **Hierarchy through drama** | Critical items feel urgent. Low-priority items recede. |
| **Keyboard as a first-class citizen** | Every interaction is reachable without a mouse. |
| **Ornament with restraint** | RPG elements appear in borders, dividers, and glow — never in content areas. |
| **Legibility above all** | Contrast ratios 7:1+ for data text. No style sacrifices readability. |

---

## 2. Color System

### Base Palette

```css
:root {
  /* Backgrounds — layered depth */
  --bg-void:       #080B14;   /* Window chrome, outermost layer */
  --bg-base:       #0D1117;   /* Main surface (like GitHub dark) */
  --bg-surface:    #161B27;   /* Panels, cards */
  --bg-raised:     #1C2333;   /* Hovered/selected items */
  --bg-overlay:    #212842;   /* Modals, popovers */

  /* Borders — ornate but subtle */
  --border-dim:    #1E2A3E;   /* Resting dividers */
  --border-mid:    #2A3A55;   /* Section separators */
  --border-lit:    #3D5280;   /* Active panel border, focus rings */
  --border-glow:   #4F6BA3;   /* Accent border on hover */

  /* Text hierarchy */
  --text-primary:  #E8EDF5;   /* Main content — near white, not pure */
  --text-secondary:#8FA3C0;   /* Metadata, timestamps, labels */
  --text-muted:    #4A607A;   /* Disabled, placeholder */
  --text-inverse:  #080B14;   /* Text on bright CTA buttons */

  /* Urgency spectrum — RPG rarity system */
  --urgency-low:      #4A607A;  /* Common — muted slate */
  --urgency-medium:   #D4943A;  /* Uncommon — amber forge */
  --urgency-high:     #C0522B;  /* Rare — ember orange */
  --urgency-critical: #C4384A;  /* Legendary — blood crimson */

  /* Urgency glow variants (for backgrounds/badges) */
  --urgency-low-bg:      rgba(74, 96, 122, 0.15);
  --urgency-medium-bg:   rgba(212, 148, 58, 0.15);
  --urgency-high-bg:     rgba(192, 82, 43, 0.18);
  --urgency-critical-bg: rgba(196, 56, 74, 0.20);

  /* Source identity colors */
  --source-jira:   #2D8EFF;   /* Jira blue — the Knight */
  --source-gmail:  #E8453C;   /* Gmail red — the Mage */
  --source-slack:  #9B6DFF;   /* Slack purple — the Wizard */
  --source-github: #3FB950;   /* GitHub green — the Druid */

  /* Source bg tints (for item rows) */
  --source-jira-bg:   rgba(45, 142, 255, 0.08);
  --source-gmail-bg:  rgba(232, 69, 60, 0.08);
  --source-slack-bg:  rgba(155, 109, 255, 0.08);
  --source-github-bg: rgba(63, 185, 80, 0.08);

  /* Interactive */
  --accent-primary: #22C55E;   /* Confirm, refresh, active — Nexus green */
  --accent-hover:   #16A34A;
  --accent-focus:   rgba(34, 197, 94, 0.35); /* Focus ring fill */

  /* Z-index scale */
  --z-base:    10;
  --z-panel:   20;
  --z-overlay: 30;
  --z-modal:   40;
  --z-toast:   50;
}
```

### RPG Urgency → Visual Language

The urgency system mirrors RPG item rarity tiers. Developers intuitively understand this grammar:

| Urgency | RPG Tier | Color | Badge Style |
|---------|----------|-------|-------------|
| `low` | Common | Slate `#4A607A` | Muted dot, no glow |
| `medium` | Uncommon | Amber `#D4943A` | Solid dot, subtle border |
| `high` | Rare | Ember `#C0522B` | Pulsing dot, glow ring |
| `critical` | Legendary | Crimson `#C4384A` | Pulsing dot + row highlight + glow |

---

## 3. Typography

### Font Pairing: Bricolage Grotesque + JetBrains Mono

This pairing was specified in the architecture document and is the right choice. Bricolage Grotesque has a **distinctive editorial weight** that reads as authoritative without being stiff — perfect for headers in a power-user tool. JetBrains Mono is the de facto standard for developer contexts, instantly signaling "this is data."

```css
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --font-display:  'Bricolage Grotesque', system-ui, sans-serif;
  --font-data:     'JetBrains Mono', 'Fira Code', monospace;
}
```

### Type Scale

| Token | Font | Size | Weight | Line Height | Usage |
|-------|------|------|--------|-------------|-------|
| `--text-app-title` | Bricolage | 15px | 800 | 1.2 | App name "◈ NEXUS HUB" in titlebar |
| `--text-section-header` | Bricolage | 11px | 700 | 1.4 | Panel labels "SOURCES", "FILTERS" |
| `--text-item-title` | Bricolage | 13px | 600 | 1.4 | Feed item titles |
| `--text-body` | JetBrains Mono | 12px | 400 | 1.6 | Item summaries, metadata |
| `--text-meta` | JetBrains Mono | 11px | 400 | 1.5 | Timestamps, source tags, IDs |
| `--text-detail-title` | Bricolage | 16px | 700 | 1.3 | Detail panel heading |
| `--text-detail-body` | JetBrains Mono | 12px | 400 | 1.7 | Detail panel body content |
| `--text-badge` | JetBrains Mono | 10px | 600 | 1 | Urgency badges, count chips |
| `--text-status` | JetBrains Mono | 10px | 400 | 1 | Status bar timestamps |

### Typography Rules

- **Never mix display and mono in the same line.** Source tags `[JIRA]` and timestamps use mono; item titles use Bricolage.
- **Section headers are ALL CAPS, letter-spacing 0.1em** — creates the "tome chapter heading" effect without decorative typefaces.
- **Detail panel title uses Bricolage at 16px/800** — the largest text in the interface, reserved for item focus.

---

## 4. Layout System

### Window Structure

```
┌─────────────────────────────────────────────────────────────────┐  ← --bg-void (titlebar drag region)
│  ◈ NEXUS HUB                           [3] ⚙  ↻               │  ← h: 36px
├──────────────┬──────────────────────────┬────────────────────────┤  ← --border-mid (1px)
│              │                          │                        │
│  SIDEBAR     │  FEED                    │  DETAIL                │
│  180px fixed │  flex: 1 (min 320px)    │  280px fixed           │
│              │                          │                        │
│              │                          │                        │
│              │                          │                        │
├──────────────┴──────────────────────────┴────────────────────────┤  ← --border-dim (1px)
│  STATUS BAR                                                      │  ← h: 24px
└─────────────────────────────────────────────────────────────────┘
```

### Panel Dimensions

| Panel | Width | Background | Border |
|-------|-------|------------|--------|
| Sidebar | 180px (fixed) | `--bg-surface` | `--border-dim` right |
| Feed | flex: 1, min 320px | `--bg-base` | none |
| Detail | 280px (fixed, collapsible) | `--bg-surface` | `--border-dim` left |
| Titlebar | 100%, 36px | `--bg-void` | `--border-mid` bottom |
| Status bar | 100%, 24px | `--bg-void` | `--border-dim` top |

### Ornamental Dividers

Panel borders are not plain `1px solid`. They use a CSS gradient to simulate a faint "illuminated manuscript" edge:

```css
.panel-divider-right {
  border-right: 1px solid transparent;
  background-image: linear-gradient(
    to bottom,
    transparent 0%,
    var(--border-mid) 10%,
    var(--border-glow) 50%,
    var(--border-mid) 90%,
    transparent 100%
  );
  background-clip: padding-box;
}
```

---

## 5. Component Design

### 5.1 Feed Item

The most repeated component in the app. Must support dense scanning at a glance.

```
┌─────────────────────────────────────────────────────┐
│ ● [JIRA]  PROJ-123 · P1 Blocker          5 min ago │  ← row height: 56px
│   Critical production bug in payment flow            │
└─────────────────────────────────────────────────────┘
```

**Anatomy:**
- Left edge: 3px colored bar (source color) — the "class flag"
- Urgency dot (8px): positioned left of source tag, color-coded
- Source tag `[JIRA]`: JetBrains Mono 10px, source color, uppercase
- ID `PROJ-123`: JetBrains Mono 10px, `--text-secondary`
- Priority badge `P1`: JetBrains Mono 9px, urgency color background
- Timestamp: JetBrains Mono 10px, `--text-muted`, right-aligned
- Title: Bricolage Grotesque 13px/600, `--text-primary`, single line truncated
- Summary: JetBrains Mono 11px, `--text-secondary`, optional second line

**States:**

| State | Background | Left bar | Title color |
|-------|------------|----------|-------------|
| Default | `--bg-base` | Source color at 60% opacity | `--text-primary` |
| Unread | `--bg-base` + subtle left glow | Source color at 100% | `--text-primary` bold |
| Hovered | `--bg-raised` | Source color at 100% | `--text-primary` |
| Selected | `--bg-overlay` | Source color at 100%, 4px wide | `--text-primary` |
| Read | `--bg-base` | Source color at 30% opacity | `--text-secondary` |
| Critical | Source critical-bg tint | Crimson, pulsing | `--text-primary` |

**CSS pattern for the left bar:**
```css
.feed-item {
  border-left: 3px solid var(--source-color, var(--border-dim));
  transition: background 150ms ease, border-color 150ms ease;
}
.feed-item:hover { background: var(--bg-raised); }
.feed-item[data-selected] { background: var(--bg-overlay); border-left-width: 4px; }
```

### 5.2 Urgency Badge

```css
.urgency-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Critical badge: animated glow pulse */
.urgency-badge[data-urgency="critical"] {
  animation: critical-pulse 2s ease-in-out infinite;
}

@keyframes critical-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(196, 56, 74, 0); }
  50%       { box-shadow: 0 0 0 3px rgba(196, 56, 74, 0.3); }
}
```

### 5.3 Sidebar

**Sources section:**
```
SOURCES                         ← Bricolage 11px/700, ALL CAPS, letter-spacing 0.1em
──────────────────────────────  ← --border-dim, 1px
◉ All                    47    ← active: --accent-primary dot + count chip
○ Jira                   12    ← inactive: --source-jira dot
○ Gmail                   8
○ Slack                  19
○ GitHub                  8
```

Each sidebar item:
- Height: 28px
- Padding: 0 12px
- Icon: 8px colored dot (SVG circle, not emoji)
- Count chip: JetBrains Mono 10px, `--bg-raised`, `--text-secondary`, min-width 20px, rounded-full

**Filters section:**
```
FILTERS
──────────────────────────────
☐ Critical only
☐ Today
☐ Unread
```

**Plugin status indicators:**
```
CONNECTIONS
──────────────────────────────
▸ Jira          ✓ Active
▸ Gmail         ⚠ Error
▸ Slack         ✓ Active
▸ GitHub        ↻ Syncing
```

### 5.4 Detail Panel

```
PROJ-123                              ← Bricolage 16px/800
Critical production bug in payment    ← Bricolage 13px/600, --text-secondary
──────────────────────────────────────
SOURCE    Jira                        ← label: JBM 10px ALL CAPS --text-muted
PRIORITY  P1 Blocker                  ← value: JBM 12px urgency-critical color
ASSIGNED  @you                        ← value: JBM 12px --text-primary
SPRINT    24.3                        ← value: JBM 12px --text-secondary
DEADLINE  Tomorrow 18:00              ← value: JBM 12px urgency-high color
──────────────────────────────────────
COMMENTS (3)
  @alice · 2h ago
  "Is this blocking deploy?"

  @you · 1h ago
  "Yes, working on it now"
──────────────────────────────────────
[Open in Jira ↗]                      ← accent button, full width
```

### 5.5 Titlebar

```
◈ NEXUS HUB          [!3]  ⚙  ↻
```

- `◈` — Custom SVG diamond glyph, `--accent-primary` (the "sigil")
- App name: Bricolage 15px/800, letter-spacing -0.02em, `--text-primary`
- `[!3]` notification chip: JBM 10px/600, `--urgency-critical` color, `--urgency-critical-bg` background, visible when any `high` or `critical` notifications exist
- Icons: Lucide SVG, 16px, `--text-secondary`, hover → `--text-primary`, cursor-pointer

### 5.6 Status Bar

```
◷ Last sync: 14:32  ·  Next: 14:47  ·  3 plugins active
```

- Font: JetBrains Mono 10px, `--text-muted`
- Separator: `·` with horizontal padding
- Height: 24px, padding 0 12px

---

## 6. Motion & Animation

All animations respect `prefers-reduced-motion`. The system uses two tiers:

### Tier 1 — Micro-interactions (always-on, imperceptible when reduced)

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Feed item hover | `background` | 120ms | `ease` |
| Feed item selection | `background`, `border-left-width` | 150ms | `ease` |
| Sidebar item hover | `background`, `color` | 100ms | `ease` |
| Button hover | `background`, `color` | 150ms | `ease` |
| Panel focus ring | `box-shadow` | 100ms | `ease` |

### Tier 2 — Meaningful transitions (skipped when `prefers-reduced-motion: reduce`)

| Element | Animation | Duration | Notes |
|---------|-----------|----------|-------|
| Detail panel slide-in | `transform: translateX(100%) → 0` | 200ms | `ease-out`, only on first open |
| Feed refresh | Items fade in staggered | 30ms delay × item index | Max 10 items staggered |
| Critical badge pulse | `box-shadow` keyframe | 2000ms | Continuous, `animation-iteration: infinite` |
| Skeleton loading | `opacity` pulse | 1500ms | `ease-in-out`, `alternate` |
| Toast notification | `translateY(-8px) + opacity` | 200ms | Slide in from bottom-right |

### Loading State (Skeleton)

While the feed is refreshing, replace item rows with skeleton placeholders:

```css
.skeleton-item {
  background: var(--bg-raised);
  border-radius: 2px;
  animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
}

@keyframes skeleton-pulse {
  from { opacity: 0.4; }
  to   { opacity: 0.8; }
}
```

Do **not** animate spinner icons continuously outside loading states.

---

## 7. Icons

**Icon library:** Lucide React (consistent 24px viewBox, `w-4 h-4` / `w-5 h-5`)

**No emoji as icons.** All interactive controls use SVG.

| Element | Icon | Size |
|---------|------|------|
| App sigil | Custom `◈` SVG | 16px |
| Notification bell | `Bell` | 16px |
| Settings gear | `Settings` | 16px |
| Refresh | `RefreshCw` | 16px |
| Jira source | Custom Jira SVG (Simple Icons) | 12px |
| Gmail source | Custom Gmail SVG (Simple Icons) | 12px |
| Slack source | Custom Slack SVG (Simple Icons) | 12px |
| GitHub source | `Github` (Lucide) | 12px |
| Plugin active | `CheckCircle2` | 12px, `--accent-primary` |
| Plugin error | `AlertTriangle` | 12px, `--urgency-high` |
| Plugin syncing | `RefreshCw` (animated) | 12px, `--text-secondary` |
| External link | `ExternalLink` | 12px |
| Mark read | `Check` | 14px |
| Snooze | `Clock` | 14px |

---

## 8. Keyboard Interaction Design

The app is a **keyboard-first** interface. Every action must be reachable without a mouse.

### Focus Model

The three panels form a logical focus ring:

```
Sidebar (Tab) → Feed (Tab) → Detail (Tab) → Sidebar (Tab)
```

Within the Feed panel, `j/k` replaces `Tab` for item navigation — matching Vim and GitHub's keyboard model which developers already know.

### Shortcut Map

| Key | Action | Context |
|-----|--------|---------|
| `j` / `↓` | Next item | Feed focused |
| `k` / `↑` | Previous item | Feed focused |
| `Enter` | Open in detail panel | Feed item focused |
| `o` / Double-click | Open in browser | Feed item focused |
| `m` | Toggle read/unread | Feed item focused |
| `s` | Snooze notification | Feed item focused |
| `r` | Refresh all plugins | Global |
| `f` | Focus feed panel | Global |
| `/` | Focus filter input | Global |
| `Cmd+K` / `Ctrl+K` | Command palette | Global |
| `Escape` | Close detail / clear selection | Global |
| `1-5` | Switch source filter | Global (1=All, 2=Jira…) |

### Focus Ring Style

```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--accent-focus);
}
```

The double-ring (dark inner + green outer) is visible on dark backgrounds and gives a subtle arcane glow effect consistent with the RPG aesthetic.

---

## 9. Screen-by-Screen Breakdown

### 9.1 Dashboard (primary)

**Purpose:** The main command view. Three-panel layout as described in section 4.

**Feed sorting:** Default is urgency × recency combined score. Toggle to pure chronological.

**Empty state:**
```
         ◈
   All clear, adventurer.
   No items match your current filters.

   [Clear filters]
```
- Centered in feed panel
- Bricolage 14px/600 for headline
- JBM 12px for subtitle

**Error state (plugin down):**
- Feed items from failed plugin retain their last-fetched data but show a `⚠ Stale · 2h ago` badge
- Sidebar shows `⚠ Error` indicator next to plugin name

### 9.2 Notifications Panel

Accessed via the `[!3]` bell chip in the titlebar. Slides in as an overlay over the detail panel.

Structure:
```
NOTIFICATIONS                    ✕
──────────────────────────────────
CRITICAL  ─────────────────────
  [JIRA] PROJ-123 · Assigned to you
  5 min ago   [Open]  [Dismiss]

HIGH  ─────────────────────────
  [GitHub] PR #456 needs your review
  20 min ago  [Open]  [Dismiss]
──────────────────────────────────
[Dismiss all]
```

- Sections separated by urgency level headers
- Quick action buttons: JBM 10px, `--bg-raised`, 28px height
- `cursor-pointer` on all interactive elements

### 9.3 Settings Panel

Full-panel replacement (not overlay) for settings. Three sub-sections in a secondary sidebar:

```
SETTINGS
──────────────────────────────
▸ Connections
▸ Notifications
▸ Heuristic Weights
▸ Appearance
▸ Keyboard Shortcuts
```

**Connections sub-panel:**
- Plugin card with status, last-sync time, Configure/Disconnect buttons
- Plugin card height: 72px
- Border-left with source color (same as feed items)

**Heuristic Weights sub-panel:**
- Range sliders (0-5) per signal
- Live preview: "With these weights, this item would be: HIGH"
- Table layout: source | signal | weight slider | current value

**Appearance sub-panel:**
- Font size multiplier (0.85x, 1x, 1.15x) — affects JBM only, Bricolage stays fixed
- Focus mode toggle (suppress below X urgency)
- Quiet hours config (time range picker)

---

## 10. Ornamental Design Details

These are the small RPG touches that distinguish the app without overwhelming the utility:

### Ornamental Separators

Section headers in the sidebar use a thin horizontal rule with a center diamond:

```
── SOURCES ─────────────────────
```

Implemented with CSS pseudo-elements — no SVG required:
```css
.section-header::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, var(--border-mid), transparent);
  margin-left: 8px;
}
```

### App Sigil

The `◈` character (U+25C8 — White Diamond Containing Black Small Diamond) is used as the app's logomark. It appears:
- In the titlebar (16px, `--accent-primary`)
- In the empty state (48px, `--text-muted`)
- As the favicon/dock icon base shape

### Subtle Background Texture

The `--bg-base` (feed panel) uses a micro-pattern:
```css
.feed-panel {
  background-color: var(--bg-base);
  background-image: radial-gradient(
    circle at 1px 1px,
    rgba(255, 255, 255, 0.015) 1px,
    transparent 0
  );
  background-size: 24px 24px;
}
```

This creates a barely-visible dot grid that adds parchment-like texture without visual noise.

### Glow Hierarchy

Glows are used only to signal urgency — never for decoration:

| Context | Glow |
|---------|------|
| Critical feed item | `box-shadow: inset 0 0 0 1px var(--urgency-critical)` |
| Critical badge pulse | `box-shadow: 0 0 0 3px rgba(196, 56, 74, 0.3)` |
| Focus ring (all interactive) | `box-shadow: 0 0 0 4px var(--accent-focus)` |
| Active panel border | `border-color: var(--border-lit)` |

---

## 11. Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Color contrast ≥ 7:1 for primary text | `--text-primary: #E8EDF5` on `--bg-base: #0D1117` → 14:1 ✓ |
| Color contrast ≥ 4.5:1 for secondary | `--text-secondary: #8FA3C0` on `--bg-base` → 5.8:1 ✓ |
| Visible focus rings | Custom double-ring (see section 8) |
| Tab order = visual order | Sidebar → Feed → Detail, left to right |
| All icon-only buttons have `aria-label` | `<button aria-label="Refresh all plugins">` |
| Source color is not the only differentiator | Source tag `[JIRA]` text always present alongside color |
| Urgency is not color-only | Urgency badge always includes text label (`CRITICAL`, `HIGH`) |
| `prefers-reduced-motion` respected | Tier 2 animations wrapped in `@media (prefers-reduced-motion: no-preference)` |
| Minimum 44×44px touch targets | All buttons: `min-height: 44px` (even in dense desktop mode) |
| Skip to main content link | Hidden link at DOM top, visible on focus, jumps to feed |

---

## 12. CSS Custom Properties — Implementation Template

```css
/* Paste into your global stylesheet or Tailwind CSS config */

:root {
  /* (full token list from Section 2) */

  /* Z-index scale */
  --z-base:    10;
  --z-panel:   20;
  --z-overlay: 30;
  --z-modal:   40;
  --z-toast:   50;

  /* Spacing rhythm (8px base) */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;

  /* Border radius */
  --radius-sm: 2px;   /* Badges, inline chips */
  --radius-md: 4px;   /* Buttons, cards */
  --radius-lg: 6px;   /* Modals, command palette */

  /* Transition defaults */
  --transition-fast:   100ms ease;
  --transition-normal: 200ms ease;
  --transition-slow:   300ms ease-out;
}
```

---

## 13. Pre-Delivery Checklist

Before shipping any screen or component:

### Visual
- [ ] No emojis used as icons — all icons are Lucide SVG or custom SVG
- [ ] Source identity: colored left-bar + source tag text (not color alone)
- [ ] Urgency identity: colored badge + text label (not color alone)
- [ ] Hover states use `background` or `color` transitions — no `scale` transforms that shift layout
- [ ] `cursor-pointer` on all clickable elements

### Interaction
- [ ] All interactive elements reachable via `Tab`
- [ ] Feed navigation works with `j/k` keys
- [ ] `Enter` opens detail, `Escape` closes it
- [ ] Focus ring visible on every interactive element
- [ ] Tab order matches visual left-to-right, top-to-bottom order

### Loading & Error States
- [ ] Skeleton shown while feed loads (not blank panel)
- [ ] Plugin error shown in sidebar with `⚠` indicator
- [ ] Stale data items show `⚠ Stale` badge
- [ ] Refresh button disabled and shows spinner during refresh

### Accessibility
- [ ] Text contrast verified: primary ≥ 7:1, secondary ≥ 4.5:1
- [ ] All icon-only buttons have `aria-label`
- [ ] `prefers-reduced-motion` wraps Tier 2 animations
- [ ] Skip-to-content link present at DOM root

### Polish
- [ ] Ornamental dot-grid texture present on feed panel
- [ ] Section separator gradient applied to sidebar headers
- [ ] `◈` sigil renders correctly in titlebar and empty state
- [ ] Critical items show pulsing glow badge
- [ ] Titlebar notification chip only visible when `high`/`critical` items exist

---

## 14. Design Decision Log

| Decision | Rationale |
|----------|-----------|
| Bricolage Grotesque for headers | Variable-width optical sizing works at 11px and 16px. Has editorial authority without medieval cliché. |
| JetBrains Mono for all data | Developer cognitive shortcut — monospace = "this is a value, not prose". |
| No gradients on backgrounds | Pure flat dark surfaces read better at small text sizes. Gradients compete with content. |
| Dot-grid texture on feed panel | Adds depth without noise. At 1.5% opacity it's subliminal — noticed subconsciously. |
| `j/k` navigation (not arrows only) | Targets the developer audience. Vim/GitHub users already have this muscle memory. |
| Urgency as RPG rarity (not traffic-light) | RGB traffic lights are overused and anxiety-inducing. Rarity tiers feel like game mechanics — engaging rather than stressful. |
| Source colors as "class colors" | Jira=Knight(blue), Gmail=Mage(red), Slack=Wizard(purple), GitHub=Druid(green) creates a coherent fantasy-team metaphor. |
| Double-ring focus style | Single-color rings disappear on both dark and colored backgrounds. The dark inner ring + colored outer ring is universally visible. |
| 7:1 contrast target (not 4.5:1) | Desktop app used during extended sessions. WCAG AAA reduces eye strain in dark-mode environments. |
