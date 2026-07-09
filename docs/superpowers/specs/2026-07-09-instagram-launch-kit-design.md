# EscapeHatch Instagram launch kit — design

**Date:** 2026-07-09
**Approved direction:** Problem→Solution→Proof arc · tasteful placeholder stats

## Goal

A rendered, on-brand **EscapeHatch Instagram profile page** at route `/ig`
(`localhost:3000/ig`) that can be screenshotted — the whole profile *or* individual
tiles — to launch/populate the real Instagram account. Plus the written assets: bio
copy, handle options, per-post captions, highlight labels.

Meta-joke intentional: the product escapes the Instagram in-app browser; this is its
Instagram feed.

## Scope

- **In:** one self-contained page `src/app/ig/page.tsx` (dark theme), using existing
  design tokens + helper classes. Delivered copy (bio/handles/captions) in the chat +
  a `docs/ig-copy.md` file.
- **Out:** no backend, no data wiring, not added to site nav, no real metrics.

## Visual system (from STYLE_GUIDE.md)

- Wrap page in `data-theme="dark"` → tokens: `--color-bg #0a0a0b`, `--color-card
  #161619`, `--color-border #27272d`, `--color-fg #fafafa`, `--color-fg-dim #a1a1aa`,
  accent `#5b8cff`, `--color-accent-soft`.
- Type: Geist body (`var(--font-sans)`), **Instrument Serif italic** headline hooks via
  `.h-editorial`. Numbers use `.tnum` (tabular). Barely-there `.grain`.
- Voice: plain, technical, quietly confident. No exclamation marks, no hype words.
- Avatar = the brand mark from `icon.tsx` (blue rounded square + escape-out-of-box arrow),
  rendered inline as SVG.

## Layout

Centered column, max ~420–470px (phone-feed width) so a screenshot reads as IG.

### Profile header
- Avatar (brand mark) · handle `@escapehatch` · display name "EscapeHatch"
- Stats row: **posts / followers / following** (placeholders, tabular)
- Bio (multi-line) + link `escapehatch.app`
- Highlights row (5 circular covers): **Problem · Proof · Setup · A/B · Brands**
- Tabs strip (grid icon active) — pure chrome, for realism.

### 3×3 grid (square tiles, 1px gaps — real IG feed)
Each tile: dark card, one blue accent, consistent padding, small `@escapehatch`
watermark, subtle grain. Reads cohesively as a designed feed.

**Row 1 — Problem**
1. HOOK (`.h-editorial`): "The in-app browser is quietly taxing every paid click."
2. "Cookies get wiped." — sub: returning shoppers look brand-new; every session starts cold.
3. "One-tap checkout breaks." — sub: Apple Pay / Shop Pay fall back to manual forms.

**Row 2 — Solution**
4. "Invisible in your analytics." — sub: GA & Shopify can't see the in-app tax; you optimize blind.
5. HERO: "One snippet. Real browser." — sub: paste one script; users land in Safari/Chrome with cookies, checkout and pixels intact.
6. "Live in ~15 minutes." — 3 numbered steps: Paste the snippet · Add the pixel · Add the webhook.

**Row 3 — Proof**
7. STAT: big "+14.2%" `.tnum` + "RPV" — sub: revenue per visitor, measured vs a live holdout.
8. A/B dashboard mock: Control vs EscapeHatch bars, incremental revenue line — "Proof you can defend to your CFO."
9. CTA: "Recover the revenue your ads leak." + `escapehatch.app →`.

## Deliverables ("everything else")

1. The `/ig` page (screenshot whole or per-tile).
2. **Bio** copy (≤150 chars, IG-ready).
3. **3 handle options** + display-name note.
4. **9 captions** — one per tile, in EH voice, for posting in order.
5. **Highlight cover labels**.

## Success criteria

- `/ig` renders at `localhost:3000/ig`, dark, cohesive, screenshot-ready at phone width.
- Grid is a legible problem→solution→proof story; numbers tabular; on-brand tokens only.
- Copy deliverables provided.
