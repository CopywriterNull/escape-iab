# EscapeHatch — project notes

A SaaS that escapes Instagram's in-app browser, redirecting IG-sourced visitors to their real browser (Safari / Chrome) before checkout breaks. Currently running on G FUEL (gfuel.com) as the first real test.

- **Repo:** `https://github.com/CopywriterNull/escape-iab`
- **Prod:** `https://escape-iab.vercel.app` (Vercel project: `copywriternulls-projects/escape-iab`)
- **Supabase:** `kfzhbkvbxzlsiqcgaoiw.supabase.co`
- **First merchant (G FUEL):** `8b6e80c0-88fd-4c9e-acab-39e21e6d7154`

## Stack

- **Next.js 16.2.6** App Router + Turbopack + React 19
- **Tailwind v4** via `@theme inline` in `src/app/globals.css` (no tailwind.config)
- **TypeScript 5**
- **Supabase** (`@supabase/ssr`) — magic-link auth, Postgres + RLS
- **Geist** font family (Sans + Mono)
- **Terser** for snippet minification + hex-escape obfuscation

`AGENTS.md` rule: Next 16 has breaking API changes. `params: Promise<...>`, `middleware.ts` deprecated → `proxy.ts`. Read `node_modules/next/dist/docs/01-app/...` before assuming APIs.

## Snippet contract (current: v5)

The storefront snippet (`src/lib/snippet.ts`) runs on every pageview. Logic:

1. **Mobile-only guard.** Desktop UAs exit immediately.
2. **IAB kind detection** — Instagram, Facebook, Messenger, TikTok, Snapchat, Pinterest, **Discord**, Line, WeChat, generic WebView.
3. **Discord** is fire-and-forget escape (no bucketing, no analytics):
   - Android → `intent://` to Chrome
   - iOS → `x-safari-https://` (works on iOS ≤17.3, silently no-ops on ≥17.4)
   - sessionStorage `eh_dc` guards loops
4. **Test population gate.** `inTest = (kind=instagram AND paid_ad_click) OR postEscape`. paid_ad_click = `fbclid` present OR (utm_source ∈ {facebook,instagram,fb,ig,meta} AND utm_medium ∈ {paid,cpc,ad}). Non-test traffic exits silently (or beacons `iab_detected` for non-IG IABs only).
5. **Bucket** via `eh_b` cookie (30-day, 50/50 random; postEscape forces `a`).
6. **IAB side:** beacon `impression` immediately (sy may be null), then escape if bucket A.
7. **Safari post-escape side:** wait up to **1500ms** for `_shopify_y` cookie before beaconing impression — this is the attribution bridge between IAB and Safari cookie jars.
8. Loop guard via sessionStorage `eh_a` + URL param `opened_external_browser=true`.
9. Optional 2s delayed fallback button for IG.

The snippet response is hex-escape obfuscated and terser-minified. Curl returns ~2.7KB of `\x..` gibberish with no readable English (no "instagram", "extbrowser", etc.).

## Pixel contract

`src/lib/pixel.ts` generates the Shopify Custom Pixel JS the merchant pastes into Customer Events. Subscribes to:

- `product_viewed`
- `product_added_to_cart`
- `checkout_started`
- `checkout_completed`

Each event sends a **GET** to `/api/track/funnel` with `event.clientId` + value/currency/order_id. GET avoids preflight/sandbox blocks. Uses both `fetch()` and `new Image()` for redundancy (de-duped server-side via `count(distinct shopify_client_id)`).

## Backend routes

| Route | Purpose |
| --- | --- |
| `/s/[merchantId]` | serves the obfuscated snippet, edge-cached `s-maxage=300` |
| `/api/track` | impression / iab_detected / escape_attempt / escape_skipped / fallback_shown / fallback_clicked |
| `/api/track/funnel` | product_viewed / add_to_cart / checkout_started / purchase (joins to bucket via shopify_client_id) |
| `/api/track/purchase` | legacy purchase endpoint (still serving for backward compat) |
| `/login` | Supabase magic-link |
| `/auth/callback` | OTP code exchange + auto-create merchant row |
| `/dashboard` | overview (funnel A vs B, lift, sources, daily chart) |
| `/dashboard/install` | snippet + pixel install instructions with merchant ID baked in |
| `/dashboard/settings` | name, domain, A/B toggle, fallback button toggle |

## Data model

- `merchants(id, user_id, name, domain, plan, ab_enabled, fallback_button)`
- `escape_events(id, merchant_id, event_type, bucket, in_test, iab_kind, shopify_client_id, value_cents, currency, order_id, url, referrer, user_agent, ip_hash, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, created_at)`
- `daily_rollups` (aggregated per day per bucket)
- `eh_test_funnel(merchant_id, since)` — RPC; returns aggregated funnel counts (avoids PostgREST's 1000-row cap). Funnel stages count distinct `shopify_client_id` to dedupe pixel double-fires + same-visitor multi-views. Purchases dedup by `order_id`.

## Migrations applied (in order)

1. `schema.sql` — initial
2. `0001_iab_kinds.sql` — multi-IAB detection
3. `0002_purchase_attribution.sql` — purchase columns + RPC signature change (user had to run constraint update separately)
4. `0003_utm_tracking.sql` — utm_source/medium/campaign/content/term + fbclid columns
5. `0004_funnel_events.sql` — product_viewed/add_to_cart/checkout_started + `in_test` column + rollup columns
6. `0005_test_funnel_rpc.sql` — `eh_test_funnel` RPC
7. `0006_unique_funnel_counts.sql` — dedupe via `count(distinct shopify_client_id)`. **First version had a column-alias bug** (couldn't find `cnt`); the corrected version (with `e.event_type::text as event_type` etc.) was the one ran successfully.

## G FUEL install state

- **Snippet:** in `theme.liquid` as first child of `<head>`, currently at `?v=5` (or higher — I told the user to bump to `?v=6` after the post-escape fix; verify with `curl gfuel.com | grep escape-iab`).
- **Pixel:** in Shopify admin → Settings → Customer events → "Instagram Paid Social (Escape)" connected. Permission: Not required.
- **Auth redirect URL added** in Supabase: `https://escape-iab.vercel.app/auth/callback`. Local needs `http://localhost:3000/auth/callback` added separately.

## Env vars (production, set in Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://kfzhbkvbxzlsiqcgaoiw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_*  (Supabase's new key format)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (legacy JWT format, service_role)
IP_HASH_SALT=f477090394d90aa14d4bc043de964b6e
NEXT_PUBLIC_SITE_URL=https://escape-iab.vercel.app
```

Local dev: pull via `vercel env pull .env.local --environment production --yes`. Override `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local`.

## Recent redesign pass (commit f16ebd0)

Used the `redesign-existing-projects` skill from `Leonxlnx/taste-skill` (now installed at `~/.agents/skills/`). Applied:

- Geist Sans + Mono replacing Inter
- New utility classes: `.h-display` `.h-section` `.tnum` `.lift` `.press` `.focus-ring` `.link-grow` `.grain` `.card` `.card-hi`
- Tinted shadows (`--shadow-card`, `--shadow-elev`, `--shadow-cta`) — never pure black
- Subtle SVG noise overlay via `.grain` (4% opacity, mix-blend-mode overlay)
- Dashboard rebuilt around a **HeroKPI** block (6xl revenue-lift % + 4 supporting tiles in 12-col asymmetric grid)
- FunnelTable with per-stage progress bars next to numbers
- Designed empty state with composed iconography
- Methodology collapsed into expandable `<details>`
- Sources card uses gradient progress bars + tabular nums
- Active hover backgrounds on rows
- All CTAs now use `lift + press + focus-ring + shadow-cta`

Other taste-skill-related: `andrej-karpathy-skills:karpathy-guidelines` is finally available — that was the long-mentioned "Karpathy plugin." Use for any nontrivial code review pass.

## Open issues / NOT verified

- **First-pageview IAB impressions still have `shopify_client_id=null`** because Shopify's Web Pixels Manager sets `_shopify_y` after our snippet runs. Only the post-escape (Safari) side waits for the cookie. IAB-side null-sy impressions can't be joined to pixel events that fire on the same visit. Acceptable for now — most G FUEL conversions happen after the escape, so the Safari-side impression captures the join.
- **Bucket A funnel events were not populating before the v5 fix.** After v5 deploy + `?v=5/6` cache bust, expected to populate. **Not yet verified with real fresh traffic.**
- **Discord escape paths untested** in production. Android `intent://` should work; iOS `x-safari-https://` will fail silently on iOS 17.4+ (acceptable since Discord iOS browser supports Apple Pay anyway).
- **`escape_skipped` rate** appears low — may indicate users hitting the loop guard, OR may be normal. Worth monitoring.

## Files map

```
src/
  lib/
    snippet.ts            # storefront IIFE, version v5
    pixel.ts              # Shopify Custom Pixel JS generator
    obfuscate.ts          # terser + hex-escape post-process for snippet
    db.ts                 # query helpers, totalize, zTestTwoProp, sampleSizePerBucket
    branding.ts           # name/tagline/subhead constants
    supabase/
      server.ts           # SSR + service role
      client.ts           # browser client
  app/
    layout.tsx            # Geist font setup, metadata
    page.tsx              # / (dark lander)
    light/page.tsx        # /light (light lander variant)
    globals.css           # design tokens + utilities
    proxy.ts              # session refresh (renamed from middleware.ts)
    login/page.tsx
    auth/callback/route.ts
    dashboard/
      layout.tsx          # auth gate, top nav
      page.tsx            # overview funnel
      install/page.tsx
      settings/page.tsx
    api/
      track/route.ts                  # snippet beacons
      track/funnel/route.ts           # pixel funnel events
      track/purchase/route.ts         # legacy purchase
    s/[merchantId]/route.ts           # serves obfuscated snippet
    actions/
      auth.ts             # signInWithMagicLink, signOut
      merchant.ts         # updateMerchantSettings
  components/
    Lander.tsx            # dark+light shared lander
supabase/
  schema.sql              # canonical full schema
  migrations/             # 0001..0006 in-place upgrades
docs/
  AB_TESTING_PLAN.md      # architecture/methodology doc
  INSTALL_GFUEL.md        # G FUEL install walkthrough
  gfuel-customer-events-pixel.js  # paste-in pixel for G FUEL with merchant ID baked in
```

## Pending TODOs (in priority order)

1. **Verify bucket A funnel data populates** after the v5 post-escape fix and migration 0006 dedup. Need 24h of fresh paid IG traffic.
2. **Test Discord on Android** — confirm `intent://` actually escapes when a Discord-Android visitor lands.
3. **Move escape-iab.vercel.app to a real domain** (`escapehatch.app` or chosen brand). Update `NEXT_PUBLIC_SITE_URL` env var, Supabase auth allow-list.
4. **Stripe billing scaffold** — pricing tiers shown on lander, no checkout wired.
5. **Shopify App Embed manifest** — currently merchants paste manually. App Embed = 1-click install.
6. **Real waitlist endpoint** on lander (currently Formspree placeholder).
7. **OG image** (`src/app/opengraph-image.tsx`) and favicon (`src/app/icon.tsx`) — both currently default Next.js.
8. **CSP-nonce variant of the snippet** for stores with strict Content-Security-Policy.
9. **Webhooks out** to Klaviyo / Triple Whale / Northbeam (Pro tier marketing promise).
10. **Karpathy guidelines skill** — use it to review nontrivial code changes; not yet applied to any commit.

## Significant commits (most recent first)

- `f16ebd0` — full redesign: Geist + tabular nums + lift/press + grain + hero KPI block
- `0d7604f` — Discord IAB escape (no analytics, fire-and-forget)
- `7d3f1cd` — wait for `_shopify_y` before post-escape impression beacon (fixes bucket A attribution)
- `19ba613` — post-escape Safari beacons impression for funnel attribution
- `34218d2` — dashboard uses RPC aggregation (escape PostgREST 1000-row cap)
- `70f75f1` — analytics rework: paid-IG-only test population + full funnel
- `99b6435` — UTM + fbclid capture
- `c53b9ce` — multi-IAB detection + A/B testing dashboard backend
- `0680d30` — Shopify Customer Events purchase attribution + cyan palette
- `8b06fbc` — bootstrap (lander + scaffolded backend)

## Things NOT to chase

- **Re-attempting iOS x-safari-https://** as a primary escape path. Broken on iOS 17.4+. We use it only as a Discord fallback, fail silently otherwise.
- **Adding 250ms delay before IG redirect.** Rejected. Link.me fires immediately; user-visible IAB flash defeats the purpose.
- **Shopify Web Pixel for the storefront snippet.** Pixel sandbox can't read `eh_b` or set escape redirects — must stay as theme App Embed / `<script>` tag.
- **Universal Links / native iOS app.** Out of scope; this is a web product.
