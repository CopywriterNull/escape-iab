# design_EscapeHatch.md

Transferable design system for any new site that wants the EscapeHatch look. Drop this into a new Next.js project alongside the assets and follow the steps in §1, and you'll have the same typography, palette, spacing, and component vocabulary on a fresh codebase.

---

## 1 · Stack + bootstrap (do this first)

Required to recreate the system 1:1:

```bash
# Framework
npx create-next-app@latest --typescript --tailwind --app

# Fonts (via next/font — no CDN, no FOIT)
# Already wired in app/layout.tsx — see §3
```

Tailwind **v4** is required — the design system uses `@theme inline` in CSS for tokens (not `tailwind.config.ts`). v3 has different syntax for custom properties.

**No UI library** (no Radix, no Shadcn, no Polaris) — the system is hand-rolled primitives in ~450 lines of `globals.css` + plain JSX components. Stays light, no opinion battles.

### `app/layout.tsx` boilerplate

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
```

---

## 2 · Design philosophy (read once, internalize)

What the system is doing visually:

1. **One palette** — cool neutral light by default. No warm cream, no terracotta, no second accent. The whole site is `#fafafa` / near-black / cobalt blue.
2. **One color signal** — every accent is the same cobalt (`#4f7cff`). Status colors (success/warn/danger) exist but are reserved strictly for genuine status states, never for visual emphasis.
3. **Two type families that disagree on purpose** — Geist Sans (technical, modern) + Instrument Serif italic (editorial, warm). The italic serif appears on exactly one phrase per section, as a stylistic signature. Reading: technical body + one emotional emphasis.
4. **Mono for numerics + labels** — Geist Mono on every number, every micro-label, every keyboard chip. `tabular-nums` everywhere so numbers don't jitter.
5. **Hairline borders + soft surfaces** — borders are 1px and barely visible. Cards float on whitespace + tiny bg contrast. No drop shadows except on lifted CTAs.
6. **Decorative effects are barely there** — a 5% noise grain (mix-blend multiply), a faint dot grid masked to fade out, a subtle radial gradient mesh. None of them dominate; they exist to break digital flatness.
7. **Restraint everywhere** — three weights total (regular 400, semi-bold 600, mono-bold 600). Five sizes. Five spacing rhythms. Nothing more.

**Brands this is the visual neighbor of**: Linear · Vercel · Stripe · Cron · Plausible.
**Brands this is NOT**: any product with rainbow gradients · 3D-rendered chrome heroes · cartoony illustration sets · "diverse team stock photos" SaaS.

### Anti-patterns (do not ship these into a transferred site)

- ❌ Rounded buttons with both icon + emoji
- ❌ Pure `#000` or pure `#fff` (use the tokens — `#09090b` and `#fafafa`)
- ❌ Mixing warm gray + cool gray neutrals (one or the other)
- ❌ More than one accent color
- ❌ Gradient text *and* gradient backgrounds in the same section
- ❌ All-caps headers (use the `.eyebrow` mono-caps pattern instead for labels)
- ❌ Title Case On Every Header (sentence case)
- ❌ Decorative SVG illustration packs
- ❌ Drop shadow ON every card (only on lifted CTAs and elevated overlays)

---

## 3 · Color tokens

Drop this whole block into `app/globals.css`. The `@theme inline` directive is Tailwind v4 — it makes every token available as `bg-[var(--color-bg)]` (and as Tailwind's `bg-bg`, `text-fg`, etc. when used in a Tailwind config v4 setup).

### Light (default)

```css
@theme inline {
  /* Surfaces — cool neutral */
  --color-bg: #fafafa;
  --color-bg-elev: #f4f4f5;
  --color-card: #ffffff;
  --color-card-hi: #fcfcfd;
  --color-border: #e4e4e7;
  --color-border-soft: #ececf0;

  /* Type */
  --color-fg: #09090b;
  --color-fg-dim: #52525b;
  --color-fg-muted: #8b8d96;

  /* CTA: near-black on white (Vercel / Linear pattern) */
  --color-cta-bg: #09090b;
  --color-cta-fg: #fafafa;

  /* Single accent */
  --color-accent: #4f7cff;
  --color-accent-soft: rgba(79, 124, 255, 0.10);

  /* Status — reserved for genuine state, not emphasis */
  --color-success: #16a34a;
  --color-success-soft: #ecfdf5;
  --color-danger: #dc2626;
  --color-danger-soft: #fef2f2;

  /* Gradient text — single-hue tonal */
  --color-grad-from: #09090b;
  --color-grad-mid: #2c2d33;
  --color-grad-to: #4f7cff;

  /* Decorative — barely there */
  --color-dot: rgba(9, 9, 11, 0.05);
  --color-mesh-1: rgba(79, 124, 255, 0.06);
  --color-mesh-2: rgba(79, 124, 255, 0.03);

  /* Shadows — neutral, soft, with subtle inset highlight */
  --shadow-card: 0 1px 0 0 rgba(255, 255, 255, 0.7) inset, 0 24px 60px -24px rgba(15, 23, 42, 0.10);
  --shadow-elev: 0 1px 0 0 rgba(255, 255, 255, 0.7) inset, 0 16px 48px -16px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(79, 124, 255, 0.04);
  --shadow-cta: 0 8px 24px -8px rgba(9, 9, 11, 0.32);
  --shadow-accent: 0 8px 24px -8px rgba(79, 124, 255, 0.4);

  /* Fonts */
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-display: var(--font-display);
}
```

### Dark (`[data-theme="dark"]`)

```css
[data-theme="dark"] {
  --color-bg: #0a0a0b;
  --color-bg-elev: #111114;
  --color-card: #161619;
  --color-card-hi: #1c1c20;
  --color-border: #27272d;
  --color-border-soft: #1c1c22;
  --color-fg: #fafafa;
  --color-fg-dim: #a1a1aa;
  --color-fg-muted: #6b6e78;
  --color-cta-bg: #fafafa;
  --color-cta-fg: #0a0a0b;
  --color-accent: #5b8cff;            /* slightly brighter cobalt on dark */
  --color-accent-soft: rgba(91, 140, 255, 0.10);
  --color-success: #3fcf8e;
  --color-success-soft: #0e2a1d;
  --color-danger: #ff5876;
  --color-danger-soft: #2a0c14;
  --color-grad-from: #fafafa;
  --color-grad-mid: #c4c8d4;
  --color-grad-to: #5b8cff;
  --color-dot: rgba(255, 255, 255, 0.04);
  --color-mesh-1: rgba(91, 140, 255, 0.08);
  --color-mesh-2: rgba(91, 140, 255, 0.04);
  --shadow-card: 0 1px 0 0 rgba(255,255,255,0.03) inset, 0 24px 60px -24px rgba(0,0,0,0.6);
  --shadow-elev: 0 1px 0 0 rgba(255,255,255,0.04) inset, 0 18px 48px -18px rgba(0,0,0,0.6), 0 0 0 1px rgba(91,140,255,0.04);
  --shadow-cta: 0 8px 24px -8px rgba(0,0,0,0.5);
  --shadow-accent: 0 8px 24px -8px rgba(91,140,255,0.4);
}
```

### Dense "backend" tool variant (`[data-theme="backend"]`)

Same dark base with slightly different surfaces + tighter radii — used when the surface is data-heavy (dashboard tables, dense lists, terminal-style screens). Identical to the dark variant above with these overrides:

```css
[data-theme="backend"] .card { border-radius: 10px; }
[data-theme="backend"] .card-hi { border-radius: 12px; }
```

### Color-scheme + base rules

```css
:root { color-scheme: light; }
[data-theme="dark"] { color-scheme: dark; }
html, body { background: var(--color-bg); color: var(--color-fg); }
body {
  font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-feature-settings: "ss01", "cv11";
}
* { border-color: var(--color-border); }
```

---

## 4 · Typography

### Fonts (3 families, all from `next/font/google`)

| Family | Variable | Purpose |
|---|---|---|
| **Geist Sans** | `--font-sans` | Body, UI, technical headlines |
| **Geist Mono** | `--font-mono` | Numbers, micro-labels, kbd chips, eyebrows |
| **Instrument Serif** | `--font-display` | Editorial accent italic — *one phrase per section* |

### Type scale (5 sizes max, do not invent new ones)

| Class / size | Use |
|---|---|
| `text-[11px]` mono | Micro-labels, timestamps, captions |
| `text-[12.5px]` / `text-[13px]` | UI body, table cell, button text |
| `text-[14-17px]` | Body paragraph, subhead, body links |
| `h-section` (~20-26px) | Card titles, section H2 |
| `h-display` (~32-72px) | Hero H1, page title |

### Utility classes

```css
.tnum, [data-tnum] { font-variant-numeric: tabular-nums; }

/* Grotesk display: tight, intentional weight. */
.h-display {
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 0.96;
}
.h-section {
  font-weight: 600;
  letter-spacing: -0.022em;
  line-height: 1.1;
}

/* Editorial display: Instrument Serif. Italic by default — single signature move. */
.h-editorial {
  font-family: var(--font-display), ui-serif, Georgia, serif;
  font-weight: 400;
  font-style: italic;
  letter-spacing: -0.015em;
  line-height: 0.98;
}
.h-editorial-up {
  font-family: var(--font-display), ui-serif, Georgia, serif;
  font-weight: 400;
  letter-spacing: -0.015em;
  line-height: 1.02;
}

/* Eyebrow — mono-caps section label */
.eyebrow {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-fg-muted);
  font-weight: 500;
}

/* Mono micro-label — slightly bolder than eyebrow */
.mono-label {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-fg-muted);
  font-weight: 500;
}

/* Keyboard chip */
.kbd {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 10.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--color-bg-elev);
  border: 1px solid var(--color-border);
  color: var(--color-fg-dim);
}

/* Gradient text — single-hue tonal */
.gradient-text {
  background: linear-gradient(135deg, var(--color-grad-from) 0%, var(--color-grad-mid) 55%, var(--color-grad-to) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

### The "two-headline" pattern (signature)

A hero H1 splits across **two lines** — the first in `h-display` (technical grotesk), the second in `h-editorial` (italic serif) and tinted with the accent color. This is the visual signature of the system.

```tsx
<h1 className="text-center max-w-4xl mx-auto text-balance px-1">
  <span className="block h-display text-[36px] sm:text-5xl md:text-7xl text-[var(--color-fg)]">
    First line states the problem.
  </span>
  <span className="block mt-1 h-editorial text-[36px] sm:text-5xl md:text-7xl text-[var(--color-accent)]">
    Second line, italic, accent color.
  </span>
</h1>
```

---

## 5 · Spacing + layout

### Rhythm (use these, not arbitrary numbers)

| Rhythm | Where |
|---|---|
| `gap-2` (8px) | inside tight inline groups (pills, button content) |
| `gap-3` (12px) | grid items (KPI tiles), card-row spacing |
| `gap-4` (16px) | card grids, primary layout columns |
| `space-y-4` / `gap-6` (24px) | section inner spacing |
| `py-16` / `py-24` / `py-28` (64/96/112px) | section vertical |

### Container

```tsx
<section className="relative">
  <div className="mx-auto max-w-6xl px-5 py-28">
    {/* content */}
  </div>
</section>
```

`max-w-6xl` (1152px) is the canonical content width. `px-5` (20px) mobile padding, optionally `md:px-6`. Section vertical padding always `py-28` (112px) for marketing; `py-6` for dashboard.

### Mobile padding

```tsx
<div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 sm:py-6">
```

Reduce from 24px to 16px on mobile when cards have their own internal padding (otherwise nesting feels too tight).

---

## 6 · Components — copy-paste recipes

### Card (the workhorse)

```tsx
<section className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg">
  <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
    <h2 className="h-section text-[14px]">Card title</h2>
    <span className="eyebrow">14d</span>
  </header>
  <div className="px-4 py-3">
    Content
  </div>
</section>
```

Use `border-border-soft` (very light) instead of `border` (medium) — softer cards read more premium.

### Card variants

```css
.card     { background: var(--color-card); border: 1px solid var(--color-border); border-radius: 18px; position: relative; }
.card-hi  { background: radial-gradient(600px 240px at 0% 0%, color-mix(in srgb, var(--color-accent) 5%, transparent), transparent 55%), var(--color-card-hi); border: 1px solid var(--color-border); border-radius: 20px; box-shadow: var(--shadow-elev); position: relative; }
.elevated { box-shadow: var(--shadow-card); }
.tile     { background: var(--color-card); border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 16px; }
.tile-hi  { background: var(--color-card-hi); border: 1px solid var(--color-border); border-radius: 8px; padding: 14px 16px; }
```

| Class | Use |
|---|---|
| `.card` | Generic marketing card |
| `.card-hi` | Featured card with subtle accent glow + elevated shadow |
| `.tile` / `.tile-hi` | Dense data tiles (dashboard) |

### KPI tile (data dashboard)

```tsx
<div className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg px-4 py-3">
  <div className="mono-label">Revenue</div>
  <div className="mt-2 h-section text-[26px] tnum">$1.2M</div>
  <div className="mt-1 text-[11.5px] text-[var(--color-fg-muted)] tnum">12,450 purchases</div>
</div>
```

### CTA button (near-black on white)

```tsx
<a className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[12.5px] font-medium press lift focus-ring">
  Start free
  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
</a>
```

### Pill / badge family

```tsx
<span className="pill pill-success">PURCHASE</span>
<span className="pill pill-info">ESCAPE</span>
<span className="pill pill-warn">CHECKOUT</span>
<span className="pill pill-danger">FAILED</span>
<span className="pill pill-muted">DRAFT</span>
```

CSS already in §7. Use mono caps, very small (`10px`), heavy letter-spacing.

### Segmented control (date range, tabs)

```tsx
<div role="tablist" className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] p-[3px] text-[12px] shadow-[0_1px_0_rgba(0,0,0,0.02)]">
  {options.map((opt) => (
    <a
      key={opt.key}
      href={`?range=${opt.key}`}
      role="tab"
      aria-selected={isActive}
      className={`relative px-2.5 py-[5px] rounded-full font-mono tnum focus-ring select-none transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.97] ${
        isActive
          ? "bg-[var(--color-bg)] text-[var(--color-fg)] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_var(--color-border-soft)_inset]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)]/60"
      }`}
    >
      {opt.label}
    </a>
  ))}
</div>
```

### Banner (status notice)

```tsx
<div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]">
  <div className="flex items-center gap-3">
    <span className="size-7 rounded-md grid place-items-center shrink-0 text-[var(--color-accent)]">
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5v4M8 11v0.5" strokeLinecap="round" />
      </svg>
    </span>
    <div>
      <div className="text-[13px] font-medium tracking-tight">Main statement</div>
      <div className="mt-0.5 text-[11.5px] text-[var(--color-fg-dim)] font-mono tnum">Supporting detail</div>
    </div>
  </div>
</div>
```

Variant: `border-danger/30 bg-danger-soft` for warning state.

### Sidebar nav (dashboard pattern)

```tsx
<aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elev)]/40 sticky top-0 h-dvh">
  <div className="px-4 h-14 flex items-center border-b border-[var(--color-border)]">
    {/* Logo */}
  </div>
  <div className="flex-1 px-3 py-4 flex flex-col gap-0.5">
    <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-[0.08em] font-medium font-mono text-[var(--color-fg-muted)]">Workspace</div>
    <a href="/dashboard" className="group flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors focus-ring">
      Overview
    </a>
  </div>
</aside>
```

240px sidebar, sticky to viewport, mobile collapses to top bar.

### Activity row (dense list item)

```tsx
<div className="px-4 py-2.5 hover:bg-[var(--color-bg-elev)]/50 transition-colors text-[12.5px]">
  <div className="grid grid-cols-12 items-center gap-3">
    <div className="col-span-2"><span className="pill pill-info">ESCAPE</span></div>
    <div className="col-span-3"><span className="pill pill-muted">BUCKET A</span></div>
    <div className="col-span-3 text-[12px] text-[var(--color-fg-dim)] tnum truncate">utm: instagram</div>
    <div className="col-span-2 text-right tnum">$58.32</div>
    <div className="col-span-2 text-right text-[11.5px] text-[var(--color-fg-muted)] tnum">3m ago</div>
  </div>
</div>
```

12-col grid on desktop, stacked on mobile via `hidden sm:grid` + `sm:hidden`.

### Form input

```tsx
<input
  type="email"
  className="h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-[14px] focus-ring placeholder:text-[var(--color-fg-muted)]"
/>
```

---

## 7 · Interaction states (every interactive element gets these)

```css
/* Hover lift — subtle, GPU-accelerated */
.lift {
  transition:
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 220ms ease,
    border-color 220ms ease;
  will-change: transform;
}
.lift:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
}

/* Pressed feedback */
.press { transition: transform 140ms cubic-bezier(0.32, 0.72, 0, 1); }
.press:active { transform: scale(0.985); }

/* Focus ring (a11y + premium signal) */
.focus-ring:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-accent) 80%, transparent);
  outline-offset: 2px;
}

/* Underline-grow link */
.link-grow { position: relative; }
.link-grow::after {
  content: "";
  position: absolute;
  left: 0; right: 100%; bottom: -2px; height: 1px;
  background: currentColor;
  transition: right 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.link-grow:hover::after { right: 0; }

/* CTA trailing icon — slides + scales on group hover */
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 9999px;
  background: color-mix(in srgb, currentColor 14%, transparent);
  transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1), background-color 220ms ease;
}
.group:hover .btn-icon {
  transform: translate(2px, -1px) scale(1.04);
  background: color-mix(in srgb, currentColor 22%, transparent);
}
```

**Cubic-bezier `(0.32, 0.72, 0, 1)`** — use this on every spring-like transition. It's the system's signature easing curve (overshoot-y, "iOS-feel").

---

## 8 · Decorative effects

These are the "barely there" texture layers that prevent the site from feeling sterile. **Use them sparingly** — one per section is usually enough.

```css
/* Subtle film grain — fixed, mix-blend, light multiply */
.grain::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.05;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.4  0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
[data-theme="dark"] .grain::before {
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.78  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

/* Radial gradient mesh — used on hero sections only */
.mesh-bg {
  background:
    radial-gradient(900px 480px at 50% -10%, var(--color-mesh-1), transparent 60%),
    radial-gradient(700px 360px at 85% 10%, var(--color-mesh-2), transparent 65%),
    radial-gradient(700px 360px at 10% 30%, var(--color-mesh-2), transparent 70%);
}

/* Dot grid — faint, fadeable */
.dotgrid {
  background-image: radial-gradient(var(--color-dot) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

### How to stack them on a hero

```tsx
<section className="relative overflow-hidden">
  {/* Layer 0: optional generated artwork (low opacity, masked) */}
  <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.22] [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_75%)]">
    <Image src="/img/hero-bg.png" alt="" fill priority sizes="100vw" className="object-cover" />
  </div>
  {/* Layer 1: mesh */}
  <div className="absolute inset-0 mesh-bg pointer-events-none" />
  {/* Layer 2: dot grid masked to fade */}
  <div className="absolute inset-0 dotgrid opacity-30 pointer-events-none [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
  {/* Layer 3: content */}
  <div className="relative mx-auto max-w-6xl px-5 pt-16 md:pt-24 pb-8">
    {/* hero copy */}
  </div>
</section>
```

The radial mask is the trick — it makes decorative layers feel like they're "fading in" from the top of the section rather than tiling edge-to-edge.

---

## 9 · Animation primitives

```css
@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success) 50%, transparent); }
  70%  { box-shadow: 0 0 0 10px color-mix(in srgb, var(--color-success) 0%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success) 0%, transparent); }
}
.pulse-ring { animation: pulse-ring 2.4s cubic-bezier(0.66, 0, 0, 1) infinite; }

@keyframes float-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.float-slow { animation: float-slow 6s ease-in-out infinite; }

/* Scroll-entry reveal — IntersectionObserver-driven; defaults visible if JS off */
.reveal { opacity: 1; transform: none; }
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    opacity: 0;
    transform: translateY(18px);
    transition: opacity 700ms cubic-bezier(0.32, 0.72, 0, 1), transform 700ms cubic-bezier(0.32, 0.72, 0, 1);
  }
  .reveal.is-visible { opacity: 1; transform: translateY(0); }
}

html { scroll-behavior: smooth; }
.scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
```

`.pulse-ring` for "live" / "active" indicators.
`.float-slow` for ambient hero objects.
`.reveal` for scroll-into-view fade-ups (hook to `IntersectionObserver` in a client component).

---

## 10 · The "what's actually built" checklist

Use this to bootstrap a new project in order. Each step takes <20 minutes:

1. **Stack** — `create-next-app@latest --typescript --tailwind --app`
2. **Fonts** — Add Geist Sans / Geist Mono / Instrument Serif via `next/font/google` in `app/layout.tsx` (copy block from §1)
3. **Tokens** — Paste `@theme inline { ... }` block from §3 into `app/globals.css`. Add dark + backend variants beneath it.
4. **Base rules** — Add `html, body`, `*`, font smoothing rules from §3
5. **Type utilities** — Paste `.h-display` / `.h-section` / `.h-editorial` / `.eyebrow` / `.mono-label` / `.kbd` / `.gradient-text` from §4
6. **Interactions** — Paste `.lift` / `.press` / `.focus-ring` / `.link-grow` / `.btn-icon` from §7
7. **Decorative** — Paste `.grain` / `.mesh-bg` / `.dotgrid` from §8 (skip ones you don't need)
8. **Cards + tiles** — Paste `.card` / `.card-hi` / `.tile` / `.tile-hi` / `.row-divide` from §6
9. **Pills** — Paste `.pill` family from §6 / status colors required
10. **Animations** — Paste `.pulse-ring` / `.float-slow` / `.reveal` from §9 (optional)
11. **Build hero** — Use the layered hero pattern from §8. Two-line H1 (grotesk + italic serif) from §4.
12. **Build a card section** — Use the card recipes from §6. Keep sections to `mx-auto max-w-6xl px-5 py-28`.
13. **Add a "live" pill or activity log** — Use `.pulse-ring` + `.pill-info` for the "active" indicator.

---

## 11 · What you'll need to swap per project

Things that ARE EscapeHatch-specific and should change for a new site:

- **`brand.tagline`** / `brand.subhead` in a `lib/branding.ts` — keep the structure, swap copy
- **Two-line H1 phrasing** — first line states problem, second line italic-accent states the twist
- **CTA destination** — `/login`, `/signup`, `#waitlist` etc.
- **Color accent** — `#4f7cff` is EscapeHatch's. Pick ONE replacement (don't add a second). Common premium choices: `#5b8cff` (slightly brighter), `#5e6ad2` (Linear purple), `#0070f3` (Vercel blue), `#635bff` (Stripe indigo).
- **Hero artwork** — generated per-site via the Higgsfield handoff if needed
- **Section structure** — Hero / Problem / How / Pricing / FAQ ordering is product-specific

Things that DON'T change (the design DNA):

- Cool-neutral palette + single accent
- Geist + Instrument Serif pairing
- Two-line italic-accent H1 pattern
- `.lift` + `.press` + `.focus-ring` interaction grammar
- `.grain` + `.mesh-bg` + `.dotgrid` decorative stack
- 12-col grids that stack on mobile
- Mono caps for labels, sentence case for headlines
- Hairline borders, lots of negative space

---

## 12 · Sources / where this came from

- Self-audit of `escape-iab` repo: `src/app/globals.css` (446 lines) + `src/components/Lander.tsx` (1390 lines) + `src/app/dashboard/page.tsx` + `src/app/dashboard/layout.tsx`
- Visual neighbors: Linear · Vercel · Stripe · Cron · Plausible · RevenueCat
- Anti-patterns sourced from the `redesign-existing-projects` skill audit checklist
- Easing curve `(0.32, 0.72, 0, 1)` borrowed from Linear's product
- Two-line italic-accent H1 pattern is the system's original signature

---

## Quick reference card

| Need | Reach for |
|---|---|
| Background | `bg-[var(--color-bg)]` |
| Card | `bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg` |
| Accent | `text-[var(--color-accent)]` |
| Big number | `h-section text-[26px] tnum` |
| Hero H1 | `h-display text-7xl tracking-tight` + accent italic in `h-editorial` |
| Eyebrow | `<span className="eyebrow">SECTION LABEL</span>` |
| CTA button | `bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] px-3 py-1.5 rounded-md press lift focus-ring` |
| Pill | `<span className="pill pill-info">LABEL</span>` |
| Hover | `lift press focus-ring` |
| Container | `mx-auto max-w-6xl px-5 py-28` |
| Mobile padding | `px-4 sm:px-6 py-5 sm:py-6` |
