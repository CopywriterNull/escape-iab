# EscapeHatch — project notes

A 1-page lander + working A/B-testing backend for a SaaS that escapes Instagram's in-app browser, redirecting visitors to their real browser (Safari / Chrome) before checkout breaks.

Repo: `https://github.com/CopywriterNull/escape-iab`

## Stack

- **Next.js 16.2.6** (App Router, Turbopack, React 19)
- **Tailwind v4** (configured via `@theme inline` in `src/app/globals.css` — no `tailwind.config.*`)
- **TypeScript 5**
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) — magic-link auth, Postgres + RLS, env-gated.

`AGENTS.md`: Next 16 has breaking changes. Read `node_modules/next/dist/docs/01-app/...` before assuming APIs. `params` is `Promise<{...}>`; `middleware.ts` is deprecated → use `proxy.ts`.

## Status

**Shipped (working end-to-end when env vars are set)**

- 1-page lander with `/` (dark) and `/light` variants — sticky nav with theme toggle, hero with iPhone-frame mockups (broken-vs-working checkout), problem stats, how-it-works, dashboard preview with SVG line chart, features, snippet preview, A/B callout, pricing, FAQ.
- **Storefront snippet** (`src/lib/snippet.ts`) — multi-IAB detection, mobile-only guard, sessionStorage + URL-param loop guard, A/B bucketing via cookie, `instagram://extbrowser/?url=...` escape with stamped `opened_external_browser=true&source_browser=instagram_in_app` params, link.me-style 2s fallback button (base64-obfuscated), telemetry beacons via `sendBeacon`. ~1.6 KB.
- **Snippet endpoint** `/s/[merchantId].js` — edge-cached `s-maxage=300` so we can ship patches fast. Returns 404 with comment body if merchant unknown.
- **Telemetry ingest** `/api/track` — validates merchant UUID + event type, hashes IP with `IP_HASH_SALT`, writes event + calls `eh_increment_rollup` RPC. CORS open. No-op (logs in dev) if `SUPABASE_SERVICE_ROLE_KEY` unset.
- **Auth** — `/login` magic-link form via Supabase OTP, `/auth/callback` exchanges code for session and auto-creates a `merchants` row, `signOut` server action, `proxy.ts` refreshes the session on every request.
- **Dashboard** at `/dashboard` (auth-gated):
  - Overview — totals (impressions, escape attempts, escape rate on bucket A, fallback shown/clicked), A/B comparison table with skipped-via-loop-guard row, daily impressions vs escapes line chart, IAB-kind breakdown bar chart.
  - `/dashboard/install` — merchant ID, copy-pasteable HTML + Liquid snippets, top-of-`<head>` placement guidance, verify-it's-working checklist.
  - `/dashboard/settings` — store name, domain, A/B toggle, fallback-button toggle (saves via server action, revalidates dashboard).
- **Database** — `supabase/schema.sql` (full DDL with RLS) + `supabase/migrations/0001_iab_kinds.sql` (idempotent migration to add multi-IAB columns to existing installs).

**Not yet built**

- Stripe billing — pricing tiers exist on the lander but no checkout / webhook / plan enforcement.
- Shopify App Embed manifest (`extension.toml`) — the 1-click install UX advantage we pitch on the lander.
- Multi-storefront support (one merchant = many sites). Schema only has 1 merchant per user today.
- CSP-nonce variant of the snippet.
- Real waitlist backend (currently a Formspree placeholder).
- OG image (`src/app/opengraph-image.tsx`) and favicon (`src/app/icon.tsx`).
- Webhooks out (Klaviyo / Triple Whale / Northbeam) — pitched on the lander, not yet wired.

## Routes

| Route | Type | Notes |
| --- | --- | --- |
| `/` | static | dark lander |
| `/light` | static | light variant of the same lander |
| `/login` | dynamic | magic-link form (server action) |
| `/auth/callback` | route | exchanges OTP code, auto-creates merchant |
| `/dashboard` | dynamic | overview metrics + A/B comparison + chart |
| `/dashboard/install` | dynamic | snippet code + merchant ID |
| `/dashboard/settings` | dynamic | A/B + fallback toggles |
| `/api/track` | route | telemetry ingest (POST JSON) |
| `/s/[merchantId]` | route | serves the storefront JS |

## Snippet contract

The script POSTs JSON beacons to `/api/track` with the shape:

```ts
{ m: merchantId, v: "v1", t: eventType, b: "a"|"b", k: iabKind|null, ig: 0|1, u: pageUrl, r: referrer, ts: epochMs, ...extra }
```

Event types:

- `impression` — every pageview from a mobile UA
- `iab_detected` — non-Instagram IAB seen (FB, Messenger, TikTok, Snap, Pinterest, Line, WeChat, generic WebView)
- `escape_attempt` — we fired `instagram://extbrowser/?url=...`
- `escape_skipped` — loop guard kicked in (sessionStorage `eh_a` or URL param `opened_external_browser=true`); `extra.r` is `"u"` (URL) or `"s"` (session)
- `fallback_shown` — the 2s floating fallback button rendered
- `fallback_clicked` — user manually tapped the fallback button

A/B bucketing is via the `eh_b` cookie (30 days). Bucket A escapes; bucket B is control (no escape). When `ab_enabled=false` everyone is treated as bucket A.

## Env vars (when activating backend)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
IP_HASH_SALT=                      # any random string for hashing IPs
NEXT_PUBLIC_SITE_URL=              # production domain when assigned
```

To activate the backend:

1. Create a Supabase project.
2. SQL editor → paste `supabase/schema.sql` (or `supabase/migrations/0001_iab_kinds.sql` if you applied the original schema before 2026-05-07).
3. Paste keys into Vercel env, redeploy.
4. In Supabase Auth settings: add `https://YOUR_DOMAIN/auth/callback` to redirect URLs.
5. Sign up at `/login`, get the magic link, land on `/dashboard`.

## What we cherry-picked from the competitor doc (and what we skipped)

The doc at `~/Downloads/instagram-in-app-browser-redirect-tech.md` was useful as a source of patterns we hadn't implemented yet. Decisions:

**Adopted**

- Mobile-only guard (`/Mobile|iPhone|iPod|iPad|Android/`) — skip desktop.
- sessionStorage + URL-param loop guard (`opened_external_browser=true`) — prevents bouncing if IG fails to hand off.
- `source_browser=instagram_in_app` query stamp — gives downstream analytics something to filter on.
- Multi-IAB detection (FB / Messenger / TikTok / Snap / Pinterest / Line / WeChat / WebView) — beaconed as `iab_detected` events for dashboard segmentation. We don&apos;t auto-escape these (no equivalent published deep-link).

**Rejected**

- Bottom-of-`<body>` placement — wrong. Top of `<head>` is correct; bottom means user briefly sees the broken IAB.
- 250ms delay before redirect — link.me fires immediately and so should we; longer delays mean more visible flash of the IAB. Keeping the option only as a future config knob if a customer asks.
- Geo lookup via external service — bloat.
- Shopify-specific Liquid `if request.page_type != 'checkout'` — conflates concerns. App Embed is the right path.

**Already had**

- A/B bucketing (50/50)
- Per-event telemetry
- Edge-cached snippet delivery
- Per-merchant config (ab_enabled, fallback_button)
- Base64-obfuscated fallback button

## Conventions

- Never `git add -A`. Stage specific files.
- Use absolute paths in subshells: `/usr/bin/git`, `/Users/lennyhuynh/.nvm/versions/node/v22.14.0/bin/npm`.
- `npm run build` after multi-file edits to catch cascading errors.

## Open TODOs

- Decide brand name + grab domain (placeholder: **EscapeHatch / escapehatch.app**). Rename in `src/lib/branding.ts` only.
- Replace Formspree action on the lander with a real waitlist endpoint.
- Wire OG image and favicon.
- Add Stripe scaffolding once pricing is validated.
- Build Shopify App Embed manifest — this is the lander&apos;s biggest install-UX promise.
- Wire webhook out to Klaviyo / Triple Whale / Northbeam (Pro tier promise).
- "Andrej Karpathy plugin" — user has referenced this multiple times across linkme + escape-iab sessions. Cannot find a matching skill or plugin in this environment. Asked once already; awaiting clarification.

## Significant commits

- `8b06fbc` — bootstrap + lander + scaffolded backend
- `1efbd92` — `/light` theme variant + nav toggle
- `4a82bff` — cleaner lander pass: dashboard preview section, SVG line chart, A/B table, less border noise
- `43d7984` — denser hero phone mockups (notched iPhone, packed checkout, broken-vs-working payment rows with red hatch overlay)
- (this commit) — multi-IAB detection in snippet, full A/B-testing dashboard backend (auth, layout, overview, install, settings, server actions, schema migration)

## Things NOT to chase

- Adding Stripe before there's a single paying-shaped customer asking to pay.
- Replacing the Supabase scaffolding with another DB. RLS is correct; ship it.
- Universal Links / Custom URL Schemes for non-IG IABs. There's no `tiktok://extbrowser` equivalent. The fallback overlay is the only realistic recovery path.
- A 250ms redirect delay. The user sees the IAB during that window — defeats the purpose.
