---
name: Rift
description: High-performance AI chat infrastructure for teams, tuned for fast candidate screening.
colors:
  accent-primary: "#3673fc"
  ai-violet: "#ad46ff"
  surface-base: "#fcfcfc"
  surface-raised: "#fafafa"
  surface-overlay: "#f7f7f7"
  surface-strong: "#e5e5e5"
  surface-inverse: "#171717"
  surface-info: "#bfdbfe"
  surface-success: "#dcfce7"
  surface-warning: "#ffedd5"
  surface-error: "#fee2e2"
  foreground-primary: "#404040"
  foreground-secondary: "#a3a3a3"
  foreground-tertiary: "#737373"
  foreground-strong: "#171717"
  foreground-info: "#1d4ed8"
  foreground-success: "#15803d"
  foreground-warning: "#c2410c"
  foreground-error: "#b91c1c"
  border-faint: "#f7f7f7"
  border-light: "#f5f5f5"
  border-base: "#05050510"
  border-strong: "#a3a3a3"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
spacing:
  xs: "0.375rem"
  sm: "0.625rem"
  md: "1rem"
  lg: "1.125rem"
components:
  button-primary:
    backgroundColor: "{colors.accent-primary}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-primary}"
    textColor: "#ffffff"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground-primary}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.foreground-strong}"
    rounded: "{rounded.md}"
    height: "2.25rem"
    padding: "0.5rem 0.75rem"
  badge-default:
    backgroundColor: "{colors.accent-primary}"
    textColor: "#ffffff"
    rounded: "2rem"
    height: "1.25rem"
    padding: "0.125rem 0.5rem"
  badge-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.foreground-secondary}"
    rounded: "2rem"
    height: "1.25rem"
    padding: "0.125rem 0.5rem"
  dialog:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.foreground-strong}"
    rounded: "{rounded.xl}"
    padding: "1rem"
---

# Design System: Rift

## 1. Overview

**Creative North Star: "The Quiet Workbench"**

Rift is a workbench, not a showroom. HR users sit down to move through a stack of candidates and walk away with a shortlist they trust. The interface earns that trust by getting out of the way: a near-white neutral surface, a single confident blue that appears only where a decision lives, and motion that confirms the user just did something rather than performing for them. Speed is the felt quality. Every hover, selection, and transition resolves in well under a quarter-second so the product feels like it is keeping up with the user's thinking, not the other way around.

Density is deliberate and local. The chrome (navigation, toolbars, settings) is calm and sparse; the data (candidate records, tables, threads) is allowed to be dense because that is where trust is built. The system borrows Attio's record/table rigor, Notion's low-friction flexible surfaces, and Linear's keyboard-fast snappiness, then strips anything decorative. Geist carries everything: headings, labels, body, and data, in one tuned family.

This system explicitly rejects enterprise heaviness (Workday/SAP ceremony and clutter), hard-to-navigate density as a default, generic AI-chat skins (ChatGPT-clone gray bubble dumps), and anything that reads as AI-slop template output. If a screen feels heavy, slow, or busy at rest, it is wrong.

**Key Characteristics:**
- Near-white, lightly-tinted neutral canvas; flat at rest, depth only on intent.
- One blue accent (`#3673fc`) reserved for primary actions, current selection, and active state.
- Single type family (Geist) across the entire surface; tight scale, weight-led hierarchy.
- Fast, state-confirming motion (100-250ms, ease-out); never choreography.
- Borders and tonal layering do the work that shadows do elsewhere.

## 2. Colors

A restrained, lightly-tinted neutral palette carrying one blue accent, with a separate reserved violet for AI activity and a standard semantic set for status.

### Primary
- **Rift Blue** (`#3673fc`): The single accent. Primary buttons, current selection, active nav item, focus-adjacent state, and link emphasis. Identical in light and dark so brand identity holds across themes. Never used as decoration or fill on inactive elements.

### Secondary
- **AI Violet** (`#ad46ff`): Reserved exclusively for AI/model activity (thinking states, AI-origin indicators). Not a general accent. Its rarity is what makes "the AI is working" instantly legible.

### Neutral
- **Canvas** (`surface-base` `#fcfcfc` light / `#161616` dark): The app background. Never pure `#fff` or `#000`.
- **Raised** (`surface-raised` `#fafafa` / `#171717`): Panels, dialogs, cards, popovers; a half-step off the canvas.
- **Overlay / Strong** (`surface-overlay` `#f7f7f7`, `surface-strong` `#e5e5e5`): Toolbars, footers, recessed regions, and the cooler/warmer second neutral layer for sidebars.
- **Foreground Strong** (`#171717` / `#fafafa`): Headings, primary data, emphasis.
- **Foreground Primary** (`#404040` / `#d4d4d4`): Default body text.
- **Foreground Secondary / Tertiary** (`#a3a3a3`, `#737373`): Placeholders, captions, meta, muted labels.
- **Borders** (`border-base` `rgba(5,5,5,0.06)`, `border-strong` `#a3a3a3`): Hairline dividers are the default depth cue. `border-base` is a translucent tint, not a solid gray line.

### Tertiary (semantic status)
- **Info / Success / Warning / Error**: paired `surface-*` tints with matching `foreground-*` text (e.g. error `#fee2e2` surface, `#b91c1c` text). Status is always communicated by icon or label plus color, never color alone.

### Named Rules
**The One Blue Rule.** Rift Blue appears on a small fraction of any screen: the primary action, the current selection, the active state. If two things on a screen compete for the blue, one of them is not the primary action. Its scarcity is the signal.

**The Violet Quarantine Rule.** `#ad46ff` belongs to AI activity only. Never borrow it for a button, a badge, or an accent. Crossing that line breaks the "what is the model doing" signal.

## 3. Typography

**Display / Body / Label Font:** Geist Variable (with `system-ui, sans-serif` fallback)
**Mono Font:** Geist Mono (with `ui-monospace, monospace` fallback)

**Character:** One family, neutral and engineered, doing every job. Geist is legible at small sizes (dense tables, labels) and confident at heading sizes without ever feeling decorative. Hierarchy comes from weight and scale, not from a second typeface.

### Hierarchy
- **Display** (600, 1.875rem / 30px, line-height 1.15, -0.01em): Page-level titles, the largest thing on a screen. Used sparingly.
- **Headline** (600, 1.25rem / 20px, 1.25): Section headers, dialog titles.
- **Title** (500, 1rem / 16px, 1.4): Card and panel headers, row group labels.
- **Body** (400, 0.875rem / 14px, 1.5): Default text and most UI copy. Cap prose at 65-75ch; tables and dense data may run wider.
- **Label** (500, 0.75rem / 12px, 1.4): Buttons, badges, captions, form labels, metadata.
- **Mono** (400, 0.875rem): Code, IDs, tokens, technical values via Geist Mono.

### Named Rules
**The One Voice Rule.** Geist is the only family. No display serif, no second sans, no mono in UI labels. Reach for weight (400 -> 500 -> 600) and size before reaching for anything else.

## 4. Elevation

Rift is flat by default. Depth is carried by hairline borders (`border-base`) and tonal layering (canvas -> raised -> strong), not by ambient shadows. Shadows appear only on genuinely floating, transient surfaces (dialogs, popovers, command palette) and stay whisper-soft. The dialog shadow is `0 2px 12px rgb(0,0,0,0.05)`: present enough to lift the surface off the page, faint enough to never read as a 2014-era drop shadow.

### Shadow Vocabulary
- **Floating soft** (`box-shadow: 0 2px 12px rgb(0,0,0,0.05)`): Dialogs and modal content. The default for anything that overlays the app.
- **Popover lift** (`shadow-md`, framework token): Dropdowns, popovers, hover cards, selects.
- **None** (`shadow-none`): Everything at rest. Cards, panels, list items, toolbars carry borders and tonal contrast, not shadows.

### Named Rules
**The Flat-At-Rest Rule.** If a surface is part of the page (a card, a row, a panel), it has no shadow. Shadows are reserved for surfaces that float above the page and disappear (dialogs, popovers). If you reach for a shadow to separate two in-page regions, use a border or a tonal step instead.

**The Audit Test.** If a card has a drop shadow at rest, it is wrong. If a dialog's shadow is darker than `rgb(0,0,0,0.08)` or its blur tighter than ~10px, it is too heavy.

## 5. Components

Built on `@base-ui/react` primitives with CVA variants. Every interactive component ships default, hover, focus-visible, active, and disabled states. Icons are `lucide-react` at 16px (`size-4`).

### Buttons
- **Shape:** Gently rounded (`rounded-lg`, 0.5rem). Icon buttons square off to the same radius.
- **Primary:** Rift Blue fill, white text, `h-8` (2rem), `px-2.5`. Hover lightens to `accent-primary/70`, active to `/50`.
- **Ghost:** Transparent, `foreground-primary` text; the workhorse for low-emphasis actions. Picks up a faint `surface-inverse/5` tint on hover, `/10` on active.
- **Danger / Danger-light / Outline / Link:** standard variants; danger is red fill, danger-light is error-tinted hover only, link is underlined blue.
- **Focus:** `focus-visible` shows a 3px `border-strong/50` ring plus a `border-strong` border. Keyboard focus is always visible (keyboard-first product).
- **Sizes:** default `h-8`, large `h-10`, icon `size-10`, plus sidebar-specific nav variants.

### Chips / Badges
- **Shape:** Fully pill-rounded (`rounded-4xl`, 2rem), `h-5`, `px-2`, label type (12px, 500).
- **Variants:** default (blue fill), secondary (raised surface, secondary text), destructive (error tint), outline, ghost, link.
- **State:** Selected/filter chips use the secondary or outline variant; active filters never rely on color alone.

### Containers / Panels
There is no `card` primitive in `@rift/ui`; the card pattern is composed from div + tokens. Dialogs and prominent surfaces are `rounded-xl` (0.75rem); inline panels are `rounded-lg`.
- **Background:** `surface-raised`, a half-step off the canvas.
- **Shadow Strategy:** None at rest (see Elevation). Separation via `border-base` hairline.
- **Border:** `border-base` translucent hairline by default; `border-strong` only for emphasis.
- **Internal Padding:** `p-4` (1rem) standard; vary for rhythm, do not pad everything identically.

### Select
- **Trigger:** Transparent (dark theme uses `surface-overlay`), `border-base` hairline, `rounded-md` (0.375rem), `h-9` default / `h-7` small, `px-3`. Trailing `lucide-react` `ChevronDown` in `foreground-secondary`. Placeholder text in `foreground-secondary`.
- **Focus:** Border shifts to `foreground-tertiary` with a 3px `foreground-tertiary/50` ring; matches the Input focus treatment exactly (one form-control vocabulary).
- **Content:** `surface-base` popup, `border-faint` border, `rounded-md`, `p-1`, `shadow-md` (floating surface, per Elevation), 100ms fade/zoom in.
- **Item:** `rounded-sm`, `px-2 py-1.5`; the highlighted item inverts to `accent-primary` background with `foreground-inverse` text. Selected item shows a trailing `Check`. This is the one place the blue is used as a fill on a transient highlight, and it disappears on close.
- **Error / Disabled:** `aria-invalid` border `foreground-error` + ring; disabled is 50% opacity, `cursor-not-allowed`.

### Table / Data Table
Unstyled-by-default, token-driven. Density is the point (this is where candidate trust is built), so the table carries more rows and less chrome than the rest of the UI.
- **Container:** wraps in a horizontally-scrollable div; `text-sm` throughout.
- **Header:** bottom `border-light` divider, `foreground-primary` medium-weight `th`, `h-10`, `px-2`, left-aligned.
- **Row:** `border-light` bottom divider; hover tints `surface-inverse/5`; selected row uses `surface-overlay` (background, not color alone). Last row drops its border.
- **Cell:** `p-2`, `foreground-primary`, vertically centered, `whitespace-nowrap`. Checkbox cells nudge `+2px` for optical alignment.
- **Footer:** `surface-overlay` background, top `border-light`, medium weight for totals/summary rows.
- **Caption:** `foreground-secondary`, `text-sm`, below the table.

### Inputs / Fields
- **Style:** Transparent background, `border-base` hairline, `rounded-md` (0.375rem), `h-9`, `px-3`. Placeholder in `foreground-secondary`.
- **Focus:** Border shifts to `foreground-tertiary` with a 3px `foreground-tertiary/50` ring. No glow.
- **Error:** `aria-invalid` border `foreground-error` + 3px `foreground-error/20` ring.
- **Disabled:** 50% opacity, `cursor-not-allowed`.

### Navigation
- **Sidebar nav items:** `h-8`, `rounded-lg`, `p-2`, body weight at rest. Hover `surface-inverse/5`, active `surface-inverse/10`. The selected item uses `surface-info/25` background, `foreground-info` text, and steps to medium weight. State is background + weight + color together, never one alone.
- **Mobile:** sidebar collapses; navigation is structural and breakpoint-driven, not fluid.

### Signature: AI Thinking State
Streaming/thinking text uses a left-to-right gray shimmer (`shimmer-text`, 1.5s ease-in-out loop) and a small `pulse-size` dot. This is the one place motion runs continuously, and it earns it: it is the live signal that the model is working. AI Violet (`#ad46ff`) marks AI-origin elements.

## 6. Do's and Don'ts

### Do:
- **Do** keep Rift Blue (`#3673fc`) on a small fraction of every screen: primary action, current selection, active state only.
- **Do** convey depth with hairline `border-base` borders and the canvas -> raised -> strong tonal steps; keep surfaces flat at rest.
- **Do** keep transitions in the 100-250ms range with `ease-out`; motion should confirm a state change, nothing more.
- **Do** use Geist for everything and build hierarchy from weight (400/500/600) and size.
- **Do** show full keyboard focus rings (`focus-visible`); this is a keyboard-first product.
- **Do** communicate status with icon-or-label plus color, so it survives color blindness.
- **Do** let candidate data and tables be dense; that local density is where trust is earned.
- **Do** honor `prefers-reduced-motion` for the shimmer, pulse, and all transitions.

### Don't:
- **Don't** build enterprise heaviness: no dense, slow, ceremony-laden Workday/SAP layouts. Calm chrome, local density only.
- **Don't** clutter or bury the next action; show the next decision, hide the rest.
- **Don't** ship a generic AI-chat skin (ChatGPT-clone gray bubble dumps) or any AI-slop template output.
- **Don't** use `#000` or `#fff`; the neutrals are tinted (`#fcfcfc`, `#161616`).
- **Don't** borrow AI Violet (`#ad46ff`) for buttons, badges, or accents; it belongs to AI activity only.
- **Don't** put shadows on in-page surfaces (cards, rows, panels); shadows are for floating, transient surfaces only.
- **Don't** introduce a second font family or use Geist Mono in UI labels.
- **Don't** add a colored `border-left`/`border-right` stripe as an accent; use full borders, tints, or leading icons.
- **Don't** rely on color alone to signal selection or status.
- **Don't** animate layout properties or add orchestrated page-load choreography; users load into a task.
