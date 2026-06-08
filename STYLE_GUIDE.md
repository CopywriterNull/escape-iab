# EscapeHatch — Design System & Style Guide

The single source of truth for how EscapeHatch looks and feels. Share this with
designers, developers, and AI tools so anything new lands on-brand without
guesswork. Everything here is extracted from the live codebase
(`src/app/globals.css`, `src/app/layout.tsx`, `src/components/Lander.tsx`).

> **Implementation note:** styling is Tailwind CSS v4 with design tokens declared
> in `@theme inline`. Always reference tokens via CSS variables
> (`var(--color-accent)`) or Tailwind arbitrary values
> (`bg-[var(--color-card)]`). **Never hardcode hex values in components** — change
> the token, not the component.

---

## 1. Brand & Voice

EscapeHatch is a developer-grade conversion tool. The visual language is
**Linear / Stripe / Vercel-inspired**: cool, neutral, precise, and confident —
not playful, not warm.

**Principles**
- **Restraint over decoration.** Cool neutral palette, a *single* blue accent. No
  gradients-for-gradients'-sake, no terracotta, no warmth.
- **One signature move.** The only flourish is an *italic serif* (Instrument
  Serif) for editorial headlines. Use it sparingly — it loses power if repeated.
- **Texture is "barely there."** Grain at 5% opacity, dot grids that fade out,
  meshes at 3–6%. If you can clearly see the texture, it's too strong.
- **Data is first-class.** Numbers are always tabular (`tnum`) so they align in
  columns. Treat metrics as a design element, not an afterthought.
- **GPU-accelerated, subtle motion.** Lifts of 1px, presses of 1.5%, soft custom
  easing. Motion confirms interaction; it never performs.

**Voice:** plain, technical, quietly confident. State the result, then the
caveat. Avoid hype words and exclamation marks.

---

## 2. Themes

Three themes, switched via a `data-theme` attribute on a wrapping element. Default
(no attribute) is the light marketing theme. **Every color is themed** — build
with tokens and theming is automatic.

| Theme | Selector | Use for |
|---|---|---|
| **Light (marketing)** | _default / `[data-theme="light"]`_ | Landing pages, marketing, public site |
| **Backend (dashboard)** | `[data-theme="backend"]` | Logged-in dashboard, operator/admin tools — dense, dark, Polaris/Linear feel |
| **Dark** | `[data-theme="dark"]` | Dark-mode marketing surfaces |

---

## 3. Color Tokens

Reference as `var(--color-*)`. Values below are the source of truth.

### Surfaces
| Token | Light | Backend | Dark |
|---|---|---|---|
| `--color-bg` | `#fafafa` | `#0a0b0e` | `#0a0a0b` |
| `--color-bg-elev` | `#f4f4f5` | `#0f1115` | `#111114` |
| `--color-card` | `#ffffff` | `#13151a` | `#161619` |
| `--color-card-hi` | `#fcfcfd` | `#181b22` | `#1c1c20` |
| `--color-border` | `#e4e4e7` | `#232730` | `#27272d` |
| `--color-border-soft` | `#ececf0` | `#1a1d24` | `#1c1c22` |

### Type
| Token | Light | Backend | Dark |
|---|---|---|---|
| `--color-fg` | `#09090b` | `#e6e8eb` | `#fafafa` |
| `--color-fg-dim` | `#52525b` | `#9097a3` | `#a1a1aa` |
| `--color-fg-muted` | `#8b8d96` | `#5e6573` | `#6b6e78` |

### Accent (single, cool blue)
| Token | Light | Backend / Dark |
|---|---|---|
| `--color-accent` | `#4f7cff` | `#5b8cff` |
| `--color-accent-soft` | `rgba(79,124,255,0.10)` | `rgba(91,140,255,0.10)` |

### CTA (near-black on white, inverts in dark)
| Token | Light | Backend / Dark |
|---|---|---|
| `--color-cta-bg` | `#09090b` | `#e6e8eb` / `#fafafa` |
| `--color-cta-fg` | `#fafafa` | `#0a0b0e` / `#0a0a0b` |

### Status
| Token | Light | Backend / Dark |
|---|---|---|
| `--color-success` | `#16a34a` | `#3fcf8e` |
| `--color-success-soft` | `#ecfdf5` | `#0e2a1d` |
| `--color-danger` | `#dc2626` | `#ff5876` |
| `--color-danger-soft` | `#fef2f2` | `#2a0c14` |

### Gradient & texture (tonal, single-hue)
| Token | Purpose |
|---|---|
| `--color-grad-from / -mid / -to` | `.gradient-text` stops — fg → mid → accent |
| `--color-dot` | Dot-grid color (~4–5% fg) |
| `--color-mesh-1 / -2` | Radial mesh tints (3–8% accent) |

**Rule:** one accent only. If you reach for a second hue, use a status color or a
neutral instead.

---

## 4. Typography

Three families, loaded via `next/font/google` in `layout.tsx`:

| Role | Family | Token | Notes |
|---|---|---|---|
| Sans (body/UI) | **Geist** | `--font-sans` | Default everywhere. `ss01`, `cv11` features on. |
| Mono (data/labels) | **Geist Mono** | `--font-mono` | Metrics, eyebrows, kbd, terminal UI |
| Display (editorial) | **Instrument Serif** | `--font-display` | Italic by default — the signature move |

### Type utility classes
| Class | Use | Key specs |
|---|---|---|
| `.h-display` | Hero / big headline | weight 600, tracking `-0.04em`, line-height `0.96` |
| `.h-section` | Section heading | weight 600, tracking `-0.022em`, line-height `1.1` |
| `.h-editorial` | Editorial headline | Instrument Serif, **italic**, tracking `-0.015em` |
| `.h-editorial-up` | Editorial, upright | Instrument Serif, non-italic |
| `.eyebrow` | Section kicker | mono, 10.5px, uppercase, tracking `0.12em`, muted |
| `.mono-label` | Dense UI label | mono, 10px, uppercase, tracking `0.06em`, muted |
| `.tnum` | **Any number** | tabular-nums — use on every metric/stat |
| `.gradient-text` | Accent headline fill | tonal fg→accent gradient clip |

**Rules**
- Headlines use **negative letter-spacing** (tight, intentional). Body stays at 0.
- Put `.tnum` on every standalone number so columns align.
- Editorial serif is italic and rare — one per page/section, max.

---

## 5. Elevation & Shadows

Soft, neutral, directional. Reference via token, not raw values.

| Token | Use |
|---|---|
| `--shadow-card` | Resting cards (`.elevated`) |
| `--shadow-elev` | Elevated/highlighted cards (`.card-hi`) — includes faint accent ring |
| `--shadow-cta` | Primary CTA buttons |
| `--shadow-accent` | Accent-colored CTAs / focus emphasis |

Shadows are large-radius and low-opacity (e.g. `0 24px 60px -24px rgba(15,23,42,0.10)`)
with a 1px inset top highlight for a "lit from above" feel. Dark themes deepen the
ambient shadow and drop the white inset.

---

## 6. Radius & Spacing

**Border radius** (marketing is rounder; backend is tighter/denser):
| Element | Marketing | Backend |
|---|---|---|
| Card (`.card`) | `18px` | `10px` |
| Highlight card (`.card-hi`) | `20px` | `12px` |
| Tile (`.tile`) | — | `8px` |
| Pills / badges / CTAs | `9999px` (fully round) | `9999px` |
| kbd | `4px` | `4px` |

**Spacing:** marketing pages are airy (large vertical rhythm, `max-w-3xl`–`max-w-6xl`
containers, `px-4 sm:px-6`). Backend/dashboard is dense (`.tile` padding `14px 16px`,
`.row-divide` hairline separators). Match the surrounding surface's density.

---

## 7. Background & Texture Utilities

All tuned to be subtle — never the focus.

| Class | Effect |
|---|---|
| `.mesh-bg` | Soft radial accent meshes (3–6%) behind hero content |
| `.dotgrid` | 24px repeating dot grid |
| `.gradient-dotgrid` | Two-tone accent+neutral dot weave, masked to fade out by 45% height — top-of-page only |
| `.grain` | Pinned fractal-noise grain at 5% opacity (`multiply` light / `overlay` dark) |
| `.terminal-bg` | Dot grid + flat bg for terminal/brutalist sections |

**Rule:** texture is decoration behind content (`z-index: 0`, `pointer-events: none`).
If it competes with text for attention, dial it down.

---

## 8. Motion

Custom easing `cubic-bezier(0.32, 0.72, 0, 1)` is the house curve. All motion is
GPU-accelerated (`transform`/`opacity` only) and subtle.

| Class | Behavior |
|---|---|
| `.lift` | Hover: `translateY(-1px)` + accent-tinted border, 220ms |
| `.press` | Active: `scale(0.985)`, 140ms — tactile button feedback |
| `.focus-ring` | `:focus-visible` 2px accent outline, 2px offset (keep for a11y) |
| `.link-grow` | Underline grows left→right on hover, 240ms |
| `.btn-icon` | Trailing CTA icon nudges `translate(2px,-1px) scale(1.04)` on group hover |
| `.pulse-ring` | Expanding success-colored ring, 2.4s loop — live/active indicators |
| `.float-slow` | Gentle 8px vertical float, 6s loop — floating decorative elements |

**Rules:** lifts are 1px, presses ~1.5%. Never animate layout properties. Always
keep `.focus-ring` for keyboard users.

---

## 9. Components

### Buttons / CTAs
- **Primary CTA:** `bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)]`, fully
  rounded (`rounded-full`), `.press .lift .focus-ring`, `box-shadow: var(--shadow-cta)`.
  Optional trailing `.btn-icon` in a `group` for the nudge-on-hover detail.
- **Secondary / ghost:** transparent bg, `text-fg-dim` → `text-fg` on hover, no border.
- Always include `.focus-ring`. Always `font-medium`.

### Cards
- `.card` — resting surface (border + radius). Add `.elevated` for `--shadow-card`.
- `.card-hi` — featured surface: faint accent radial in the corner + `--shadow-elev`.
- `.tile` / `.tile-hi` — compact dashboard surfaces (backend theme).

### Badges & Pills
- Fully rounded, `border border-[var(--color-border-soft)]`, `bg-[var(--color-card)]`,
  small mono text (`text-[11px] font-mono`).
- **Live indicator:** prefix with a `size-1.5 rounded-full bg-[var(--color-success)]`
  dot plus `.pulse-ring`.
- Numbers inside pills use `.tnum`.

### Nav
- Sticky, `backdrop-blur-md`, semi-transparent bg
  (`bg-[var(--color-bg)]/80`), `border-b border-[var(--color-border)]/60`,
  `h-16`, container `max-w-6xl`.
- Nav links: small, `text-fg-dim` → `text-fg` on hover.

### Labels & keys
- `.eyebrow` for section kickers, `.mono-label` for dense UI labels,
  `.kbd` for keyboard hints.

---

## 10. Do / Don't

**Do**
- Build with tokens (`var(--color-*)`) and let theming happen automatically.
- Put `.tnum` on every number.
- Keep one accent; use status colors for meaning (success/danger).
- Use the italic serif as a rare signature, not a habit.
- Keep textures and motion subtle and GPU-accelerated.
- Match the density of the surface you're on (airy marketing vs. dense backend).
- Keep `.focus-ring` on every interactive element.

**Don't**
- Hardcode hex colors in components.
- Introduce a second accent hue, warm tones, or terracotta.
- Stack multiple editorial-serif headlines in one view.
- Make grain/dot/mesh textures visibly strong.
- Animate `width`/`height`/`top`/`left` (layout thrash) — use `transform`.
- Use heavy drop shadows; shadows are large-radius and low-opacity.
- Add gradients without purpose — the only sanctioned gradient is `.gradient-text`.

---

*Source of truth: `src/app/globals.css` (tokens + utilities), `src/app/layout.tsx`
(fonts), `src/components/Lander.tsx` (component patterns). When the code and this
doc disagree, fix the doc.*
