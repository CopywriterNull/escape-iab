# EscapeHatch — project notes

A SaaS that escapes Instagram's in-app browser, redirecting paid-Meta-ad visitors to their real browser (Safari / Chrome) before checkout breaks. Live on G FUEL (gfuel.com) as the first real merchant.

- **Repo:** `https://github.com/CopywriterNull/escape-iab`
- **Prod:** `https://escape-iab.vercel.app` (Vercel: `copywriternulls-projects/escape-iab`)
- **Supabase:** `kfzhbkvbxzlsiqcgaoiw.supabase.co`
- **First merchant (G FUEL):** `8b6e80c0-88fd-4c9e-acab-39e21e6d7154`

## Stack

- **Next.js 16.2.6** App Router + Turbopack + React 19
- **Tailwind v4** via `@theme inline` in `src/app/globals.css`
- **TypeScript 5**
- **Supabase** (`@supabase/ssr`) — magic-link auth, Postgres + RLS
- **Geist** Sans + Mono fonts; **Instrument Serif** for editorial accents
- **Terser** for snippet minification + hex-escape obfuscation

`AGENTS.md`: Next 16 has breaking API changes. `params: Promise<...>`, `middleware.ts` deprecated → `proxy.ts`. Always read `node_modules/next/dist/docs/01-app/...` before assuming APIs.

## Current visual system

- **Default palette:** cool neutral. Off-white `#fafafa` bg, near-black `#09090b` text, single blue accent `#4f7cff`. Linear / Vercel / Stripe inspired. **No terracotta, no warm cream — all of that was killed.**
- **Dark theme:** pure cool grays, same blue accent.
- **Typography:** Geist Sans body, Geist Mono for numerics/labels, Instrument Serif italic for editorial accents via `.h-editorial`.
- **Utility classes:** `.h-display` (giant tracking-tight headlines), `.h-section` (mid section headlines), `.h-editorial` (italic serif), `.tnum` (tabular nums), `.mono-label` (small uppercase tracked), `.kbd` (terminal-style keyboard chip), `.tile` / `.tile-hi` (Polaris-style flat cards), `.row-divide`, `.pill` + `.pill-success` / `.pill-info` / `.pill-warn` / `.pill-danger` / `.pill-muted` (CI/CD-style status badges), `.grain` (subtle SVG noise overlay), `.lift`, `.press`, `.focus-ring`, `.link-grow`.
- A brutalist-mono "terminal" theme (`.terminal` + `.terminal-bg` + dot grid) was shipped then reverted — lives in `globals.css` if needed later.

## Dashboard

**Layout:** left sidebar (240px) with logo + workspace nav + test-status card + user pill. Mobile collapses to a horizontal top nav. Lives at `src/app/dashboard/layout.tsx`.

**Overview page** (`src/app/dashboard/page.tsx`) uses Polaris-structured primitives (no Polaris dependency):
- `<Page>` with eyebrow + h-display title + subtitle + actions row + range selector
- `<RangeSelector>` — 24h / 7d / 14d / 30d / 90d segmented control bound to URL `?range=` param (defaults to 14d)
- `<Card>` — hairline border, optional title + action header
- `<Layout>` + `<LayoutCol>` — 7/5 column split
- `<Banner>` — info/warning banner with status dot (attribution gap)
- `<KPIGrid>` + `<KPI>` — 4 dense tiles
- `<FunnelTable>` — IndexTable-style rows with hover bg, per-row lift % and p-value
- `<SourcesCard>` — ResourceItem-style rows
- `<ChartCard>` — minimal line chart, single accent fill
- `<SampleSizeCard>` — progress bar toward MDE@95%
- `<ActivityCard>` + `<ActivityRow>` — recent funnel events with PURCHASE/ESCAPE/CHECKOUT/ATC pill chips

## Snippet contract (current: v7)

Storefront snippet (`src/lib/snippet.ts`) runs on every pageview. Logic in order:

1. **Mobile-only guard** — desktop UAs exit immediately
2. **IAB kind detection** — instagram / facebook / messenger / tiktok / snapchat / pinterest / discord / line / wechat / generic webview
3. **Discord** is fire-and-forget escape (Android `intent://`, iOS `x-safari-https://`) with sessionStorage loop guard. **No bucketing, no analytics.**
4. **eh_sid** — generate or read persistent UUID, stored in `eh_sid` cookie (30d), URL on escape, and Shopify cart attribute
5. **Test population gate:** `inTest = (kind=instagram AND paid_ad_click) OR postEscape`. `paid_ad_click` = `fbclid` present OR `utm_source ∈ {facebook,instagram,fb,ig,meta}` + `utm_medium ∈ {paid,cpc,ad}`. Non-test traffic exits silently (or beacons `iab_detected` for non-IG IABs only).
6. **Bucket** via `eh_b` cookie (50/50). postEscape forces bucket A.
7. **IAB side:** beacon impression immediately, then escape via `instagram://extbrowser/?url=<dest>` with `eh_sid` + `eh_escape=1` + `opened_external_browser=true` + `source_browser=instagram_in_app` stamped on dest.
8. **Safari post-escape side:** wait up to 1500ms for `_shopify_y` cookie, then beacon impression with proper sy for funnel attribution.
9. **Cart attribute write:** `POST /cart/update.json` with `{attributes: {eh_sid: UUID}}` — Shopify same-origin endpoint. Then `GET /cart.json` to verify + capture `cart_token`. Beacons `cart_check` event with `ck=0|1` (success flag, stashed in value_cents) + `ct=cart_token`.
10. Loop guard via sessionStorage `eh_a` + URL param `opened_external_browser=true`.
11. Optional 2s fallback button for IG.

Response is terser-minified + hex-escape obfuscated. ~2.7KB. No readable English (no "instagram", "extbrowser", etc.).

## Pixel (Shopify Custom Pixel)

`src/lib/pixel.ts` generates the paste-in. Subscribes to:
- `product_viewed`
- `product_added_to_cart`
- `checkout_started`
- `checkout_completed`

Each event sends **GET** to `/api/track/funnel` with `event.clientId` (sy) + value/currency/order_id + tries to read `eh_sid` from `event.data.cart.attributes` / `checkout.attributes`. **The pixel cannot reliably read cart.attributes** — Shopify's pixel sandbox doesn't expose them for these event types in practice (confirmed: 0/438 product_viewed events had eh_sid). This is the gap that motivated the Order webhook.

## Backend routes

| Route | Purpose |
| --- | --- |
| `/s/[merchantId]` | serves obfuscated snippet, edge-cached `s-maxage=300` |
| `/api/track` | impression / iab_detected / escape_attempt / escape_skipped / fallback_shown / fallback_clicked / cart_check |
| `/api/track/funnel` | product_viewed / add_to_cart / checkout_started / purchase (multi-key join: shopify_client_id → eh_sid) |
| `/api/track/purchase` | legacy purchase endpoint (still serves for backward compat) |
| `/api/webhooks/shopify/orders` | **primary purchase attribution path** — HMAC-verified Shopify Order webhook |
| `/login` | Supabase magic-link |
| `/auth/callback` | OTP code exchange + merchant auto-creation |
| `/dashboard` | overview (funnel, banner, KPIs, sources, daily chart, activity log) |
| `/dashboard/install` | snippet + pixel install instructions |
| `/dashboard/settings` | A/B + fallback toggle |

## The attribution architecture (the hardest part)

**Why this is hard:** Shopify splits a visitor across 4 separate cookie jars that don't share state:

```
Storefront     IAB              Safari (post-escape)    Checkout / Shop Pay
gfuel.com      gfuel.com        gfuel.com               checkout.shopify.com
_shopify_y=A   _shopify_y=B     _shopify_y=C            _shopify_y=D
eh_sid=A1      eh_sid=A1        eh_sid=A1 (via URL)     ??? (often lost)
cart cookie    cart cookie      cart cookie             preserved (cart_token)
```

`event.clientId` at `checkout_completed` is the checkout-subdomain `_shopify_y`, NOT the storefront's. The pixel join keeps failing because of this.

**Solution: multi-key join, in order of precision:**

1. **`cart_token`** — Shopify-native, survives every flow including Shop Pay express, Apple Pay, returning customers, subscriptions. Set on `cart_check` events when our snippet wrote it.
2. **`eh_sid`** — works when `landing_site` URL preserved our marker
3. **`fbclid`** — fallback for paid Meta clicks where neither above survived

**Shopify Order webhook** at `/api/webhooks/shopify/orders` does the join. Configuration:
- Shopify admin → Settings → Notifications → Webhooks
- Event: `Order paid`
- Format: JSON
- URL: `https://escape-iab.vercel.app/api/webhooks/shopify/orders`
- API version: latest
- Filters: `source_name=web` only (excludes Recharge subscriptions, POS, manual, B2B wholesale)
- Value cap: $99,999 max per order to prevent corrupt data poisoning totals (one Shopify $3.1M row torched our totals earlier)

## Data model

- `merchants(id, user_id, name, domain, plan, ab_enabled, fallback_button)`
- `escape_events(id, merchant_id, event_type, bucket, in_test, iab_kind, shopify_client_id, eh_sid, cart_token, value_cents, currency, order_id, url, referrer, user_agent, ip_hash, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, created_at)`
- `daily_rollups` (aggregated per day per bucket)
- `eh_test_funnel(merchant_id, since)` RPC — returns aggregated funnel counts. Impressions count distinct `eh_sid` (dedupes IAB + Safari post-escape pair). Funnel stages count distinct `shopify_client_id`/`eh_sid`. Purchases dedup by `order_id`.

## Migrations applied

| # | What |
| --- | --- |
| `schema.sql` | initial |
| 0001 | multi-IAB detection |
| 0002 | purchase columns + RPC signature |
| 0003 | UTM + fbclid columns |
| 0004 | product_viewed / add_to_cart / checkout_started event types + in_test column |
| 0005 | `eh_test_funnel` RPC |
| 0006 | dedupe funnel via `count(distinct shopify_client_id)` |
| 0007 | `eh_sid` column |
| 0008 | `cart_check` event type + RPC counts distinct `eh_sid` for impressions |
| 0009 | `cart_token` column |

Each migration is idempotent (uses `IF EXISTS` / `IF NOT EXISTS`). Several required user-correction during application due to column-alias bugs in PostgREST UNION ALL — those are now embedded in the migration files with explicit `as event_type` aliases.

## Env vars (production, set in Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://kfzhbkvbxzlsiqcgaoiw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_*    (new Supabase format)
SUPABASE_SERVICE_ROLE_KEY=eyJ...                  (legacy JWT, service_role)
IP_HASH_SALT=f477090394d90aa14d4bc043de964b6e
NEXT_PUBLIC_SITE_URL=https://escape-iab.vercel.app
SHOPIFY_WEBHOOK_SECRET=7bf4420c2888cd34841609b527d05ce8
SHOPIFY_WEBHOOK_MERCHANT_ID=8b6e80c0-88fd-4c9e-acab-39e21e6d7154
```

Local dev: `vercel env pull .env.local --environment production --yes`. Override `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Add `http://localhost:3000/auth/callback` to Supabase Auth → URL Configuration → Redirect URLs.

## G FUEL install state

- **Snippet:** in `theme.liquid` as first child of `<head>`, currently `?v=7` (or `?v=8` if user bumped).
- **Pixel:** in Shopify admin → Settings → Customer events → "Instagram Paid Social (Escape)" → connected.
- **Shopify webhook:** configured, signing secret in Vercel env, HMAC verified.
- **Auth redirect:** `https://escape-iab.vercel.app/auth/callback` added in Supabase Auth.

## Marketing / UVP

**Tagline (live):** *"Your Instagram ads work. Your Instagram checkout doesn't."*

**Subhead:** *"Every paid IG visitor lands in a stripped-down browser where Apple Pay disappears, Shop Pay autofill breaks, and your CVR tanks. EscapeHatch reroutes them out — into Safari, into checkout, into purchase. One snippet. Sixty seconds."*

`brand.positioning` in `lib/branding.ts` has four below-hero positioning beats ready to render as discrete sections: `cost` / `cause` / `fix` / `proof`. Not yet wired into the lander as 4 sections — current lander has a single Problem section that covers most of this. Worth rebuilding the lander into the 4-beat flow when ready.

**Alt taglines** under consideration (in priority order):
- "Reclaim 30% of your Meta ROAS." (sells dollars to perf marketers)
- "Apple Pay, where Apple Pay should be." (memorable, jargon-free)
- "Your IG traffic isn't bad. Instagram is." (reframes the frustration)

**Naming directions** (not yet committed):
- Stay with **EscapeHatch** (current, descriptive but locked to one feature)
- **Metalift** (.io likely available) — defensible, performance-marketing positioning
- **Slipstream** (.shop / .io) — premium, brandable, surives any pivot
- **Reroute** (.shop) — descriptive without being literal
- **Lift** (.shop / .ads) — direct value prop, may be taken

**Business direction:** Direction 2 (ecom CRO / ad-performance tool) is cleaner than Direction 1 (Linktree-for-ecom). Less crowded category, higher LTV, sharper wedge. Pitch resonates with brands spending $50k+/mo on Meta ads.

## Open visual TODOs

- **Logo** — multiple ChatGPT image-gen prompts drafted (arrow escape, bracket/portal, E-monogram, ascending chevrons, slipstream line, offset squares). Not yet committed.
- **Favicon** — currently default Next.js
- **OG image** — `src/app/opengraph-image.tsx` not yet built
- **Hero image / video** — currently imageless (intentional, Linear/Vercel style). If we add, best options: phone mockup of IG IAB → Safari escape, or a 3-second video loop. Higgsfield MCP installed for image-gen.
- **4-beat positioning sections** below hero (cost/cause/fix/proof) — copy in `branding.ts`, not yet rendered

## Tools / MCPs installed

- **Higgsfield (official CLI + 4 skills)** — image & video generation. **Updated 2026-05-10**: official path is `npm i -g @higgsfield/cli` + `npx skills add higgsfield-ai/skills` (NOT the community `uvx higgsfield-mcp` we'd registered earlier — that MCP entry has been removed from `~/.claude.json`).
  - CLI installed globally; aliases `higgs`, `hf`. Binary at `~/.nvm/.../bin/higgsfield`.
  - 4 universal skills installed to `./.agents/skills/`: `higgsfield-generate`, `higgsfield-product-photoshoot`, `higgsfield-marketplace-cards`, `higgsfield-soul-id`. Claude auto-fires the right skill on trigger words.
  - **User must run `higgsfield auth login` once** (interactive browser OAuth). Verify with `higgsfield account status`.
  - **Full handoff doc at [`HIGGSFIELD.md`](./HIGGSFIELD.md)** — brand context, official model routing (Soul Location for environments, GPT Image 2 default, Soul 2.0 / Soul Cinema for editorial, Seedance 2.0 for video), MCSLA prompt formula, approved style anchors, image registry by slot, 7 copy-paste templates incl. Product Photoshoot, A/B variant pattern, CLI cheatsheet. Read end-to-end before generating.
- **`uv` / `uvx`** installed at `~/.local/bin` via Astral installer.
- **Taste skills** from `Leonxlnx/taste-skill` package — 12 design-focused skills at `~/.agents/skills/` (design-taste-frontend, high-end-visual-design, redesign-existing-projects, minimalist-ui, gpt-taste, stitch-design-taste, imagegen-frontend-web/mobile, brandkit, image-to-code, industrial-brutalist-ui, full-output-enforcement). Invoke via `Skill` tool.
- **`andrej-karpathy-skills:karpathy-guidelines`** — available. Use for nontrivial code reviews.

## Known issues / structural limits

1. **Pixel can't read cart.attributes** — Shopify's pixel sandbox doesn't expose `event.data.cart.attributes` for product_viewed / cart_viewed / checkout_completed events in practice. The cart attribute write succeeds (cart_check `ck=1` events confirm this) but the pixel side of the chain is broken. **Webhook-based attribution via cart_token is the workaround.**

2. **~90% of Shopify orders have `landing_site=null`** — Shop Pay express checkouts, returning authenticated customers, subscription orders, cart-recovery emails. URL-based attribution alone is structurally insufficient.

3. **Cross-device / view-through attribution we cannot capture** — Meta uses 7-day click + 1-day view across devices. We only see same-cookie-chain visitors. Meta's reported numbers will always exceed ours. The right comparison is our "All purchases (pixel-recorded)" total vs Shopify Analytics → Acquisition "instagram" segment.

4. **Bucket A impressions inflated** by 2x previously (IAB-side + Safari post-escape both counted) — fixed via `count(distinct eh_sid)` in migration 0008.

5. **Most current purchases unattributed** (`in_test=false` in DB) — because they were generated under older snippet versions that didn't write cart_token. As fresh v=7 traffic flows for 24-48h, attribution rate should rise meaningfully via cart_token join in the webhook.

## Open product TODOs

- **Verify cart_token attribution actually closes the gap** — need 24-48h of paid IG traffic with v=7 snippet to validate. Expect attribution rate to rise from current ~1% to 50-70%+ of pixel-seen purchases. Remaining gap is structural (cross-device / view-through).
- **Name decision** — commit to EscapeHatch or pivot to Metalift / Slipstream / Reroute / Lift
- **Domain purchase** — currently on `escape-iab.vercel.app`. Wire custom domain after name decision. Update `NEXT_PUBLIC_SITE_URL` + Supabase auth allow-list.
- **Real waitlist endpoint** — currently Formspree placeholder
- **Stripe billing scaffold** — pricing tiers on lander but no checkout / webhook / plan enforcement
- **Shopify App Embed manifest** — currently merchants paste manually. App Embed = 1-click install
- **CSP nonce variant** of the snippet for stores with strict CSP
- **Webhooks out** (Klaviyo / Triple Whale / Northbeam) — pitched as Pro feature
- **4-beat positioning sections** in lander
- **Test Discord IAB in production** — currently coded but no real traffic confirmed
- **Multi-merchant support** — current Shopify webhook hardcodes one merchant via env var. Real product needs Shopify shop domain → merchant_id lookup.

## Significant commits (most recent first)

- `ce9c55f` — UVP rewrite: "Your Instagram ads work. Your Instagram checkout doesn't."
- `b7b0dd0` — dashboard typography matches homepage (h-display + accent eyebrows)
- `9b3f010` — brutalist mono terminal aesthetic (rolled back)
- `a792e3e` — dashboard left sidebar nav (Polaris/Vercel style)
- `af74731` — dashboard Polaris-structured rewrite with KPIGrid + FunnelTable + Activity log
- `f9fe52f` — dashboard inherits default light theme (no forced dark)
- `32ee99c` — kill terracotta + backend theme tokens + webhook source_name filter
- `d1468eb` — $99,999 value cap + webhook diagnostic logging
- `2c84daa` — webhook searches note_attributes / checkout.attributes for eh_sid
- `c799a81` — Shopify Order webhook + URL marker (?eh_escape=1) + cart_check diagnostic
- `60fe671` — eh_sid: persistent visitor ID surviving cookie-jar breaks
- `0c432c6` — capture unattributed purchases + attribution gap banner on dashboard

## Things NOT to chase

- **Direct pixel attribution via event.clientId** — broken by Shopify's checkout subdomain. Use cart_token via webhook instead.
- **Trying to make landing_site populate for Shop Pay orders** — Shopify literally doesn't track those. cart_token is the workaround.
- **Polaris library install** — heavy, opinionated. Polaris-inspired primitives (Page, Card, Layout, Banner) built without the dep work fine.
- **iOS x-safari-https://** as primary escape — broken on iOS 17.4+. Use only as Discord fallback.
- **250ms delay before IG redirect** — user sees IAB during the delay window. Defeats the purpose.
- **Universal Links / native iOS app** — out of scope, this is a web product.

## Next-session resume prompt

> I'm working on EscapeHatch (https://github.com/CopywriterNull/escape-iab), a SaaS that escapes Instagram's in-app browser for paid Meta ad clicks. Repo at ~/Desktop/escape-iab. Prod at https://escape-iab.vercel.app. First customer is G FUEL.
>
> Read NOTES.md first — it's the canonical state. Don't re-derive what's documented.
>
> This session's priorities (pick what's most useful):
> 1. **Verify cart_token attribution working** — query DB for purchases with cart_token populated vs total. Should be rising as fresh v=7 traffic accumulates.
> 2. **Wire the 4-beat positioning sections** in the lander (cost/cause/fix/proof — copy is in `lib/branding.ts`).
> 3. **Generate hero image** via Higgsfield MCP (user must paste keys first into `~/.claude.json`).
> 4. **Name + logo finalization** — multiple options drafted in NOTES.
> 5. **Stripe billing scaffold** — pricing tiers exist on lander, need checkout flow.
>
> Taste skills available: design-taste-frontend, high-end-visual-design, redesign-existing-projects, minimalist-ui, andrej-karpathy-skills:karpathy-guidelines. Use via Skill tool.
>
> Don't migrate frameworks. Don't break working A/B data flow. Push to prod and verify routes return 200 after meaningful changes.
