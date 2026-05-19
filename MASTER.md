# EscapeHatch — master review doc

**Last updated:** 2026-05-17 · **Branch:** `master` · **Prod:** [getescapehatch.com](https://getescapehatch.com)

> Single review-and-action document. The "do this first" sits at the top; deeper architecture / history lives in [`NOTES.md`](./NOTES.md) and session-level details in [`HANDOFF.md`](./HANDOFF.md).

## 2026-05-18 Codex update

The previous top-priority notes about `0016_ab_split_pct.sql` being pending are stale. Live Supabase already has `merchants.ab_split_pct`, `eh_test_funnel`, and `eh_test_sources`, and telemetry is actively arriving.

What was actually causing the slow/blank dashboard:
- **Admin impersonation data blanking:** several dashboard reads used the cookie-auth Supabase client after `getCurrentMerchant()` had already resolved an impersonated merchant. RLS then hid rows for merchants not owned by the admin user.
- **Slow aggregate reads:** `eh_test_funnel` and `eh_test_sources` were timing out against the growing `escape_events` table. New concurrent indexes are live, and both RPCs now force custom plans so Postgres uses those indexes.
- **Docs drift:** `HANDOFF.md` still reflects the earlier pre-deploy state. Treat this dated note as the fresher operational state.

New migration file on disk: `supabase/migrations/0017_dashboard_perf_and_rls.sql`.

---

## 2026-05-19 Codex update

Latest production commits are pushed to `main`.

What changed most recently:
- Dashboard impersonation/data loading was fixed by moving impersonated dashboard reads to service-role paths where RLS was hiding rows.
- Slow dashboard aggregate paths were optimized with live DB indexes/RPC updates in `0017_dashboard_perf_and_rls.sql`.
- Homepage proof language no longer leads with recovered-dollar framing. It now emphasizes percentage lift, including revenue-per-visitor lift.
- Homepage "escapes" proof now uses all merchants over a rolling last-24h window, not only G FUEL since UTC midnight.
- "Get early access" is now a full lead-capture form. It posts to `/api/early-access`, which forwards to `EARLY_ACCESS_WEBHOOK_URL`.
- Production still needs `EARLY_ACCESS_WEBHOOK_URL` set in Vercel before the form can deliver submissions.

Merchant user access state:
- Current merchant ownership is one `merchants.user_id` per merchant.
- Admin can impersonate any merchant through `/admin/merchants`.
- Admin can claim unowned merchants for the current admin user.
- There is no invite-by-email UI yet. Manual assignment means updating `merchants.user_id` to the target Supabase Auth user id after they have logged in once.
- Auth callback currently creates a blank merchant for first-time users without a merchant. A future invite flow should short-circuit that when a pending invite exists.

Client-facing share page idea:
- Best v1: create `/share/[token]` with a `merchant_share_links` table.
- Store only hashed tokens/passwords, `enabled`, optional `expires_at`, and `merchant_id`.
- Render a read-only report/dashboard with summary metrics only. No settings, raw rows, install snippets, admin controls, or merchant UUIDs.
- Password-protected shares can set an httpOnly route-scoped cookie after successful password entry.
- Quick demo alternative: one env-based password protecting a single report route, useful for sales calls but less clean long-term.

---

## ⚡ DO THESE NOW (top priority)

These are the current next actions. Older notes about `0016_ab_split_pct.sql` and uncommitted defensive settings fixes are historical.

### 1. Set the early-access webhook env var
The homepage lead form is live in code, but delivery depends on Vercel env:

```bash
EARLY_ACCESS_WEBHOOK_URL=https://...
```

After setting it in Vercel, redeploy. Env var changes do not affect already-running deployments.

### 2. End-to-end verify andar's escape works
On the latest deploy:

1. **From your test phone**: clear `andar.com` site data in Safari, force-quit Instagram.
2. **DM yourself**: `https://www.andar.com/?eh_force=a` from inside Instagram.
3. **Tap the link**. Expect: Safari opens with `?opened_external_browser=true&eh_sid=...` in the URL.
4. **In [Vercel runtime logs](https://vercel.com/copywriternulls-projects/escape-iab/logs)**, filter `/api/track`. Expect:
   - `t:"impression"` with `m:"b8596aac..."`, `b:"a"`, `as:0`, `forced:1`, `k:"instagram"`
   - `t:"escape_attempt"` immediately after
5. **Place a $0.01 test order** through the escaped Safari window with code `TESTOK` or similar. Expect:
   - Pixel: `t:"checkout_started"` event arrives at `/api/track/funnel`
   - Webhook: `[shopify-webhook]` log line with `orderId` + `cart_token` joined to `merchant_id:"b8596aac..."`
6. **Open `/dashboard` (impersonating andar)**. The test purchase should appear in the funnel attributed to bucket A within 30s.

If any of those don't fire, see [Operator runbook](#-operator-runbook) below.

### 3. Confirm A/B split slider works

1. `/dashboard/settings` (impersonating andar) → drag A/B slider to 70.
2. Save. Banner says ✓ Saved.
3. `curl -s 'https://getescapehatch.com/s/b8596aac-...js?v=$(date +%s)' | grep -oE 'Math\.random\(\)<[0-9.]+' | head -1` — should show `Math.random()<.7` or similar (anything not `<.5`).
4. Drag back to 50, save, re-curl, should show `<.5` again.

### 4. Decide on client share/report access
If clients need to see metrics without dashboard login, build `/share/[token]` as a read-only report with optional password. This is safer than handing out admin/dashboard access and cleaner than a one-off screenshot.

---

## 📊 Status snapshot

| Surface | Status | Notes |
|---|---|---|
| Snippet `v10` on prod | ✅ Live | `x-eh-version: v10` confirmed on andar + G FUEL URLs |
| Edge cache 1h with on-write revalidate | ✅ Live | `s-maxage=3600`, every merchant write calls `revalidatePath('/s/{id}.js')` |
| `?eh_force=a\|b` QA bypass | ✅ Live | Pins bucket per visit, stamps `forced:1` on beacons |
| Async self-diagnostic (`as:1` beacon) | ✅ Live | `console.warn` stripped by `drop_console:true` — beacon flag is the operational signal |
| `/admin/simulator` trace runner | ✅ Live | 11 UA presets, sandboxed snippet execution |
| Configurable A/B split (slider 1–99) | ⚠️ Code shipped, migration pending | See [#1](#1-apply-migration-0016_ab_split_pctsql-in-supabase) |
| Defensive settings save | ⚠️ On disk, not deployed | See [#2](#2-commit--push-the-defensive-settings-save-fix) |
| Andar end-to-end attribution | ⚠️ Not yet verified | See [#3](#3-end-to-end-verify-andars-escape-works) |
| G FUEL (steady state) | ✅ Working | Reference install, no known issues |
| Marketing site dark mode | ✅ Live | `getescapehatch.com` |
| v2 lander | 🟡 Preview at `/preview/landing/next` | Approve to flip prod to `variant="v2"` |

---

## ✅ Shipped this session

### Snippet `v10` (commit `f609419`)
- **Async self-diagnostic** — reads `document.currentScript.async/.defer` on boot; stamps `as:1` on every `/api/track` beacon. Operators grep Vercel logs for `as:1` to find any merchant who installed with async (the recurring failure mode).
- **`?eh_force=a|b` QA bypass** — pin a bucket for this visit only, no cookie writes, beacons stamped `forced:1`. Bypasses AB silent return, eh_a sticky guard, paid_only gate, kill switch. Lets desktop+IG-UA QA verify escape behavior without bucket roulette.
- **Configurable A/B split** — `SPLIT` constant baked into compiled JS from `ab_split_pct` DB column. Replaces hardcoded `Math.random()<0.5` everywhere.

### Install bug fix
**Root cause**: `/dashboard/install/page.tsx` was generating `<script src="..." async></script>` — the one surface every new merchant pulls from. Every other surface (admin merchants, admin guides, public install page) said "don't use async." That drift is why andar.com (and G FUEL twice) had to be re-debugged with "remove async" every install.
- Generated tag now sync. Red callout in install UI explaining the pitfall + Edgemesh auto-async warning.
- `docs/INSTALL_GFUEL.md` aligned.

### Settings UI
- **`<SplitSlider />`** client component — range slider 1–99 with live A/B readout, accent fill bar, quick-set chips (20/30/50/70/80), 50/50 reset.
- Mounted under the A/B toggle on `/dashboard/settings`.

### Infrastructure
- **Edge cache 5min → 1h** — `s-maxage=3600`. ~12× fewer function invocations on `/s/[id].js` at steady state.
- **On-write revalidation** — every merchant write (`updateMerchantSettings`, `createMerchantAsAdmin`, `deleteMerchantAsAdmin`, `assignMerchantToCurrentUser`, `renameMerchantAsAdmin`, `setMerchantShopifyDomain`) calls `revalidatePath('/s/{id}.js')`. Settings propagate in seconds despite 1h TTL.

### Admin tooling
- **`/admin/simulator`** (commit `0c0f03d`) — pick merchant + UA preset + URL + cookies, click "Run trace." Compiled snippet executes in a sandboxed scope (mocked navigator/location/document/fetch/sendBeacon/setTimeout/sessionStorage) wrapped in an outer function whose params shadow the globals. Captures every beacon payload, cookie write, sessionStorage write, would-be `location.replace`. Renders verdict + critical flags + step-by-step trace.
- 11 UA presets: IG iOS/Android, Threads, FB iOS/Android, Messenger, TikTok, Snapchat, Discord, mobile Safari (control), desktop (control).
- Sidebar entry added between Merchants and Guides.

### Docs / handoffs
- `NOTES.md` — new "Recurring incident: snippet installed with async" section + QA runbook + v10 contract.
- `HANDOFF.md` — session-level handoff with what works / what's not deployed / continuation prompt.
- This doc.

---

## ⚠️ Things to consider (open decisions)

### Structural risks (not yet fixed)
1. **Install-tag template drift.** The `<script src="..."></script>` template is hand-written in 5 surfaces: `/install/[id]`, `/admin/merchants`, `/admin/guides`, `/dashboard/install`, `docs/INSTALL_GFUEL.md`. They're aligned now but the next refactor can reintroduce drift. **Right fix:** extract `src/lib/snippet-tag.ts` helper, every surface imports it. Not yet done.
2. **`forced:1` not persisted to `escape_events`.** Beacon stamps the flag on the wire (visible in Vercel logs, useful for live debugging) but `/api/track` insert doesn't have a `forced` column to write into. QA traffic still pollutes dashboard metrics. **Fix:** migration adding `forced boolean default false` + insert-side wiring at `src/app/api/track/route.ts:116`.
3. **`as:1` not persisted either.** Same shape. If you want a dashboard-level "this merchant has an async install" indicator, add the column.
4. **Console warning stripped in production.** `src/lib/obfuscate.ts:104` has `drop_console: true`. The v10 async-detection `console.warn` doesn't make it to merchant devtools. Either flip drop_console for our snippet, or accept that `as:1` beacon is the only signal. Probably fine to keep stripped — beacon is more reliable.

### Open product decisions
- **v2 lander rollout.** Preview at `/preview/landing/next` (mounts `<Lander variant="v2" />`). To flip prod: change `src/app/page.tsx` to `<Lander variant="v2" />`. Worth one more pass at the v2 sections before promoting.
- **Stripe Checkout for $300 self-serve.** Pricing tiles on the lander but no checkout flow → no webhook → no plan enforcement. Mentioned as next-best lever multiple sessions.
- **Single-source install snippet refactor** (see Structural risks #1).
- **Weekly email digest** to merchants (mentioned as growth lever).
- **Pre-fill `/login` form with `?email=`** (mentioned earlier, never shipped).

### Things NOT to chase (from `NOTES.md` lessons)
- Direct pixel attribution via `event.clientId` — broken by Shopify's checkout subdomain. Use `cart_token` via webhook.
- iOS `x-safari-https://` as primary escape — broken on iOS 17.4+. Discord fallback only.
- 250ms delay before IG redirect — user sees IAB during delay window.
- Universal Links / native iOS app — out of scope.

---

## 🛠️ Operator runbook

### Onboarding a new merchant
1. **Provision** at `/admin/merchants` → "Add merchant" → name + storefront domain.
2. **Set Shopify admin domain** (the `*.myshopify.com` one, NOT the public storefront domain) for webhook routing.
3. **Hand them the install URL**: `https://getescapehatch.com/install/{merchant_id}`. That page has the sync `<script>` snippet + Customer Events pixel.
4. **They install both**, save theme. Confirm in `/admin/diagnostics` — should show LIVE/PAID-or-ALL/AB-on/Fallback-on flags and impressions within 30s of real IG traffic.

### Snippet says installed but no escape
**99% of the time, root cause is one of:**
1. `<script>` tag has `async` or `defer` — IG webview commits before snippet runs. Check: `curl -s 'https://getescapehatch.com/s/{id}.js?v=$(date +%s)'` and look for `as:1` on impressions in Vercel logs.
2. They installed from `/dashboard/install` pre-fix (had async) — get them to update to the new tag.
3. Edgemesh / theme optimizer is auto-adding async — disable for this tag specifically.
4. They're in bucket B (50% silent control). Clear `andar.com` site data on phone, force-quit IG, retry. Or use `?eh_force=a`.
5. `sessionStorage.eh_a="1"` from a prior attempted-but-failed escape on same WebView. Force-quit IG to discard.

**Verification order:**
- `/admin/simulator` → run trace with their merchant + IG iOS preset. If verdict is "WOULD ESCAPE", logic is fine — issue is install-side.
- Curl the snippet, check for `==="b"` (AB on, bucket B silent) and `r:"k"` (kill switch on).
- Vercel logs for `m:"{merchant_id}", t:"impression"` — if absent, snippet never executed (CSP, async, theme not saved).

### Flipping A/B or split percentage
1. `/dashboard/settings` (or impersonate the merchant first via `/admin/merchants`).
2. Flip toggle or drag slider. Save.
3. `revalidatePath` invalidates cache automatically — propagation < 60s typically.
4. **Belt-and-suspenders:** if the change must propagate instantly, bump `?v=N` on the install tag.

### Kill switch (emergency stop, no theme edit)
1. `/dashboard/settings` → toggle "Escape engine" off.
2. Snippet still beacons impressions (so dashboard shows traffic) but `location.replace` is skipped. Compiled JS contains `r:"k"` exit path.
3. To verify: `curl -s '...?v=fresh' | grep -oE 'r:"k"'`.

### Reset all data for one merchant (clean A/B start)
```sql
delete from public.escape_events where merchant_id = '...';
delete from public.daily_rollups where merchant_id = '...';
-- merchant row + config stays
```
Also clear `eh_b/eh_a/eh_sid` cookies on test devices manually (SQL doesn't touch client cookies).

---

## 📐 Architecture (quick reference)

For full architecture see [`NOTES.md`](./NOTES.md). Quick map:

```
Storefront pageview
    │
    ▼
[storefront <head>] <script src="getescapehatch.com/s/{id}.js?v=N"></script>  ← SYNC, NO async
    │ (function invocation only on cache miss; 1h TTL + revalidate on writes)
    ▼
/s/[merchantId]/route.ts → reads merchants row → buildSnippet(opts) → terser obfuscate
    │
    ▼ (served, cached at edge)
Snippet runs in browser:
    ├─ mobile + IAB UA gate (desktop bails here)
    ├─ ASYNC self-check → as:1 if loaded async
    ├─ eh_force=a|b URL flag → forced:1, bypass AB / paid_only / kill switch / eh_a
    ├─ kind detection (instagram / threads / facebook / messenger / tiktok / …)
    ├─ inTest = isMetaIAB && (FORCED || !paid_only || isPaidAd) || postEscape
    ├─ bucket assignment via eh_b cookie (or eh_force override)
    ├─ beacon → /api/track {impression, b, k, sy, sid, ig, it, as, forced, …}
    ├─ cart_check → fetch /cart/update.json + /cart.json (Shopify same-origin)
    └─ if bucket A: location.replace(instagram://extbrowser/?url=<dest>) + fallback button at 2s

Post-escape Safari side:
    ├─ ?opened_external_browser=true on URL stamps "this visitor was just escaped"
    ├─ wait for _shopify_y cookie, then beacon impression with sy (funnel join)
    └─ writeCartAttr again so cart_token survives the cookie-jar break

Funnel pixel (Shopify Custom Pixel):
    └─ checkout_started / product_viewed / add_to_cart / purchase
       → /api/track/funnel → join by cart_token → eh_sid → fbclid

Shopify Order webhook:
    └─ Order paid (HMAC-verified) → /api/webhooks/shopify/orders
       → resolved via X-Shopify-Shop-Domain → merchants.shopify_domain
       → join order to impression by cart_token
       → write purchase event into escape_events
```

**Attribution join keys, in order of precision:**
1. `cart_token` (most reliable — survives Shop Pay, Apple Pay, returning customers, subscriptions)
2. `eh_sid` (works when landing_site URL preserved)
3. `fbclid` (fallback for paid Meta clicks where neither above survived)

---

## 🔧 Setup

### Production env vars (set in Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://kfzhbkvbxzlsiqcgaoiw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_*
SUPABASE_SERVICE_ROLE_KEY=eyJ...
IP_HASH_SALT=f477090394d90aa14d4bc043de964b6e
NEXT_PUBLIC_SITE_URL=https://getescapehatch.com
SHOPIFY_WEBHOOK_SECRET=7bf4420c2888cd34841609b527d05ce8
SHOPIFY_WEBHOOK_MERCHANT_ID=8b6e80c0-88fd-4c9e-acab-39e21e6d7154
```

Local dev: `vercel env pull .env.local --environment production --yes` then override `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

### Migrations
Apply in order via Supabase SQL Editor. Each is idempotent.

| # | Purpose | Status |
|---|---|---|
| `schema.sql` | initial tables | ✅ applied |
| 0001 | multi-IAB detection | ✅ applied |
| 0002 | purchase columns + RPC signature | ✅ applied |
| 0003 | UTM + fbclid columns | ✅ applied |
| 0004 | funnel event types + in_test column | ✅ applied |
| 0005 | `eh_test_funnel` RPC | ✅ applied |
| 0006 | dedupe funnel via distinct client_id | ✅ applied |
| 0007 | `eh_sid` column | ✅ applied |
| 0008 | `cart_check` event + distinct eh_sid for impressions | ✅ applied |
| 0009 | `cart_token` column | ✅ applied |
| 0010 | sources RPC | ✅ applied |
| 0011 | merchant kill switch | ✅ applied |
| 0012 | paid_only toggle | ✅ applied |
| 0013 | merchant.user_id optional | ✅ applied |
| 0014 | merchant.shopify_domain | ✅ applied |
| 0015 | paid_only default off + retro-flip | ✅ applied |
| **0016** | **ab_split_pct column** | ⚠️ **PENDING — see [Action #1](#1-apply-migration-0016_ab_split_pctsql-in-supabase)** |

### Stack
- Next.js 16.2.6 App Router + Turbopack + React 19
- Tailwind v4 via `@theme inline` in `src/app/globals.css`
- TypeScript 5
- Supabase (`@supabase/ssr`) — magic-link auth, Postgres + RLS
- Geist Sans + Geist Mono + Instrument Serif italic for editorial accents
- Terser for snippet minification + hex-escape obfuscation
- Vercel Fluid Compute (default Node runtime — edge runtime is no longer recommended per Vercel's current guidance)

---

## 🧪 QA + testing tools

### `/admin/simulator`
The simulator runs the production snippet against a synthetic environment with mocked browser globals. Use it to verify any merchant's gate logic without opening Instagram.

**What it tests:** UA-kind detection, paid_only gate, A/B silent return, `eh_a` sticky guard, kill switch, async self-diagnostic, bucket assignment, beacon payloads, cookie writes, the would-be `location.replace` target.

**What it can't test:** whether iOS actually honors the `instagram://extbrowser/?url=` handoff once we fire it. That's OS-level behavior — needs one real-phone test per build, not per-merchant.

### Vercel runtime log greps (for live debugging)
```
m:"<merchant_id>"          all events for one merchant
t:"impression",b:"a"       bucket A impressions
t:"escape_attempt"         where the redirect actually fired
as:1                       installed with async — bug
forced:1                   QA traffic via ?eh_force
r:"k"                      kill switch firing
r:"s"                      eh_a sticky exit
[shopify-webhook]          incoming Order paid events
```

### QA checklist for a new install
1. `curl -sI 'https://getescapehatch.com/s/{id}.js?v=qa'` — expect 200, `x-eh-version: v10`.
2. `curl -s '…?v=qa' | tail -c 400` — expect `setTimeout(...location.replace(s)...)` (NOT `r:"k"`).
3. `/admin/simulator` → run trace with IG iOS UA → expect verdict "WOULD ESCAPE."
4. Real phone, IG IAB, paid-UTM link with `?eh_force=a` → expect Safari handoff in ~1s.
5. `$0.01` test order → verify dashboard shows the purchase attributed to bucket A within 30s.

---

## 📚 Related docs

| File | What it has |
|---|---|
| [`NOTES.md`](./NOTES.md) | Canonical project state — stack, schema, attribution architecture, all migrations, known issues, marketing copy, alt taglines, name decisions |
| [`HANDOFF.md`](./HANDOFF.md) | Session-level handoff (2026-05-17) — what's deployed, what's on disk only, continuation prompt for next agent session |
| [`docs/INSTALL_GFUEL.md`](./docs/INSTALL_GFUEL.md) | Concrete merchant install guide (snippet + Customer Events pixel) |
| [`docs/AB_TESTING_PLAN.md`](./docs/AB_TESTING_PLAN.md) | A/B testing methodology — sample size, z-test, attribution architecture rationale |
| `/admin/guides` (in app) | Live operator playbooks — sync-script pitfall, cache busting, kill switch, paid-only, multi-tenant webhook, pixel setup, `?eh_force=a\|b` QA, full QA checklist |

---

## 🎯 Recommended next-session priorities

1. **Apply migration 0016** (see [Action #1](#1-apply-migration-0016_ab_split_pctsql-in-supabase))
2. **Commit + push defensive settings fix** (see [Action #2](#2-commit--push-the-defensive-settings-save-fix))
3. **End-to-end QA andar** (see [Action #3](#3-end-to-end-verify-andars-escape-works))
4. **Verify slider** (see [Action #4](#4-confirm-ab-split-slider-works))
5. **Add `forced` + `as` columns** to `escape_events` so QA traffic and async-installed merchants surface in dashboard metrics (one migration + two lines in `/api/track/route.ts`)
6. **Single-source install tag refactor** — extract `src/lib/snippet-tag.ts`, refactor 5 surfaces to import. Kills the recurring async-drift bug structurally.
7. **Promote v2 lander** — confirm `/preview/landing/next` is ready, flip `src/app/page.tsx` to `variant="v2"`
8. **Stripe Checkout for self-serve $300** — pricing tiles exist, need checkout + webhook + plan enforcement

---

## 🧠 Operating principles (lessons from this session)

- **The install snippet tag MUST run synchronously.** No `async`, no `defer`. The IG WebView commits to rendering on a tight schedule; if our `location.replace(instagram://extbrowser/...)` fires after `didCommit`, the scheme is silently dropped. This is the recurring failure mode. Snippet v10 self-diagnoses it (`as:1` beacon).
- **Snippet flags are baked at GET time, behind a 1h edge cache.** Settings changes are revalidated explicitly on write. If propagation seems slow, bump `?v=` on the install tag.
- **Trust the user's browser view over your curl output.** CDN / region / cache effects can make `curl` and a real browser disagree about what HTML is served. When they conflict, debug the discrepancy — don't dismiss the browser view.
- **Bucket B is silent by design — don't confuse it with broken.** With AB on, ~half of test population is silent control. QA tests look "broken" until you clear cookies and re-roll, or use `?eh_force=a`.
- **Install-surface drift is the recurring incident pattern.** Same `<script>` template hand-written across 5 places → next refactor reintroduces inconsistency → next new merchant repeats the debug. Fix structurally with a single source.
