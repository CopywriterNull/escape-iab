# EscapeHatch Operations — the runbook

**Status: CANONICAL.** Last verified against code + prod on **2026-08-05**. If this file disagrees with `MASTER.md`, `NOTES.md`, or `HANDOFF.md`, this file wins — those three are frozen historical snapshots from May 2026 and carry a superseded banner. The one other technical doc still current is `docs/attribution-symmetry-and-scale.md` (2026-07-11).

New team member? Read this top to bottom once, then live out of the **Daily cadence** section. Everything here is doable from the admin console at `getescapehatch.com/admin` (Supabase-auth + email allowlist in `src/lib/admin.ts`).

---

## 1. What the product does (60 seconds)

Merchants paste one script tag into their Shopify theme. When a visitor arrives inside Instagram's in-app browser (IAB), the snippet escapes them to the real browser (Safari/Chrome) via `instagram://extbrowser/?url=…` before first paint. Real browsers have saved passwords, Shop Pay/Apple Pay autofill, and sessions that survive app-switching — so escaped visitors convert dramatically better (see `/case-studies`).

Every install starts as a randomized **50/50 A/B test**: bucket `a` = escaped, bucket `b` = control (left in the IAB). The test window is the proof; after it, brands roll out to 90/10 or 100% and we bill on measured performance.

**Event flow:** IG click → snippet (`/s/<merchantId>.js`) → beacons to `/api/track` → `escape_events` table → hourly cron aggregates into `hourly_funnel_rollups` → every dashboard. Purchases arrive via each store's Shopify order webhook (`/api/webhooks/shopify/orders`).

---

## 2. Surface directory

### Admin (login + allowlist)
| Route | What it's for |
|---|---|
| `/admin` | Platform 24h stats, quick-nav |
| `/admin/merchants` | Approval queue, create/rename/configure, kill switch, install snippet, **Copy share link**, delete |
| `/admin/performance` | Cross-brand RPV/CVR lift table (`?range=`, `?outliers=1` for raw) |
| `/admin/billing` | Invoice queue, earnings, setup/billing-view links, **Start performance plan**, charge/void |
| `/admin/referrers` | Affiliate partners: create, assign brands, share %, **Copy partner link** |
| `/admin/links` | **Link hub — every shareable URL in one place** (share/billing/report/install/partner/case-studies) |
| `/admin/health` | Install checks, went-dark + stale-rollup detectors, rollup refresh buttons |
| `/admin/simulator` | Sandboxed snippet tester (mock IG UA) |
| `/admin/guides` | In-app playbooks (cache busting, kill switch, webhook setup, `?eh_force` QA) |
| `/admin/diagnostics` | Live config snapshot per merchant |

### Tokened public views (unguessable URL = access; no login)
| Route | Backing column | Shows | Minted from |
|---|---|---|---|
| `/share/<token>` | `merchants.billing_view_token` | Full read-only merchant dashboard (all range/funnel toggles) | /admin/merchants → Copy share link |
| `/billing/view/<token>` | same token | Merchant-facing billing/earnings view | /admin/billing → Billing view |
| `/r/<token>` | `merchants.report_token` | Static shareable report | (legacy; mint via SQL) |
| `/partner/<token>` | `referrers.view_token` | Partner earnings dashboard + links into their brands' dashboards | /admin/referrers → Copy partner link |
| `/billing/setup/<token>` | `merchants.billing_setup_token` | Stripe card-capture page. **Each "Copy setup link" click mints a NEW token and silently kills the old link** — only generate when you're about to send it |

### Merchant-facing (their login)
`/dashboard` (results), `/dashboard/install`, `/dashboard/settings`, `/dashboard/team` (+ email invites via `/invite/<token>`), `/dashboard/report`.

### Public / marketing
`/` (lander), `/case-studies` (+ 10 slugs, data in `src/lib/case-studies.ts`), `/for-brands`, `/get-started`, `/signup`, `/ig` suite + `/l` (social collateral).

---

## 3. Daily cadence (~10 minutes)

1. **/admin/health** — the two banners are the whole job:
   - **Went dark**: escape-enabled merchant with no IG impression >48h → their ad traffic stopped or the tag was removed. Check the storefront HTML for the `<script src=".../s/<id>.js">` tag before assuming ads.
   - **Stale rollups**: the hourly cron missed → every dashboard undercounts. Press **Roll up last 24h**. (Cron = `/api/cron/retention` at :17; the rollup refresh rides on it, so one cron failure stales ALL analytics. It has stalled before: 5/23, 6/11, 6/15.)
2. **/admin/merchants** — approval queue: Inspect → Approve (emails the owner) or Reject (deletes; confirm dialog).
3. **/admin/billing** — "Needs attention" queue: `pending_review` invoices to review/charge, `failed` charges to retry (see §6).
4. Glance **/admin/performance** (7d default, trimmed): any brand flipped red? Usually a whale order (toggle Raw) or a starved control after a 90/10 ramp — not a real regression.

Weekly: review each active brand's test window (graduate 50/50 winners to a plan, §6), check `/admin/diagnostics` for accidentally-disabled merchants, and pay partners what `/admin/referrers` says you owe.

---

## 4. Merchant lifecycle runbook

**Signup → live:**
1. Prospect signs up (`/signup`) → appears in `/admin/merchants` approval queue as `pending`. Approve.
2. Confirm **domain** on the merchant row — empty domain = snippet fires on any hostname (the Hostname binding audit flags this).
3. Send the install snippet (on the row) or `/install/<id>`. **Rule #1: no `async`/`defer`, first `<script>` in `<head>`.** The async attribute is the single most common install failure — the escape must fire before IG commits to rendering.
4. Set up the **order webhook** (Shopify → Settings → Notifications → Webhooks → Order creation → `https://getescapehatch.com/api/webhooks/shopify/orders`). Save the store's **per-store signing secret** into `merchants.shopify_webhook_secret` and the `*.myshopify.com` admin domain into `shopify_domain`. Wrong secret = silent 401 `bad_hmac` = purchases never record (symptom: impressions fine, zero purchases).
5. Verify on `/admin/health`: install check green, impressions arriving, then a test purchase attributing.
6. Let the 50/50 run 7–14 days. **Don't call tests early** (Glimmr read ~0 at day 3, finished +41% at z=6.5).

**Config changes propagate slowly:** the snippet edge cache is **1 hour** (`max-age=3600`). After flipping kill switch/paid-only/etc., bump the `?v=` number in the merchant's script tag to bust it, or wait.

**QA tricks:** `?eh_force=a|b` pins a bucket (beacons carry `forced:1`); `/admin/simulator` fakes an IG visit.

---

## 5. Measurement doctrine (why numbers look the way they do)

- **Read funnels from `hourly_funnel_rollups`**, never `daily_rollups` — its `impressions` column is dead (zeroed after 2026-05-20). A query that divides by it looks "broken" but is just wrong-sourced.
- **Lift is only credible from the A/B window** (`eh_ab_test_window` RPC finds it). After a brand ramps to 90/10 or 100%, the control is starved — recent-window "lift" explodes meaninglessly (PURE showed +517% vs a real ~+170%). Dashboards handle this via the **locked baseline**; you should too when quoting numbers.
- **Outlier trimming is the default** (order > Q3+3·IQR and > 8× median, both arms, revenue only — never purchase counts). One $51K wholesale order in PURE's control once made control "win"; one $3.2K order flipped NJS red. Toggle `?outliers=1` to see raw.
- **Significance**: two-proportion z-test on CVR. z ≥ 2 ≈ 95%. Case-study-grade is z ≥ 3.
- **Attribution asymmetry with Meta**: iOS strips `fbclid` on the escape handoff, so Ads Manager *undercounts escaped conversions* (they show as DIRECT). The snippet re-carries it (`eh_fbclid`, restored pre-pixel), but when a merchant says "escape ROAS looks worse in Meta," the answer is measurement, not performance — point them to first-party lift and Shopify's Meta CAPI. (Full story: Kaiyo case study + `docs/attribution-symmetry-and-scale.md`.)

---

## 6. Money: billing state machine

**Model:** $300/mo base fee (waivable per merchant) + `rev_share_pct` (default 10%) of **trimmed incremental revenue** = escaped revenue minus what the control RPV says those visitors would have produced anyway. Control RPV prefers the locked A/B window.

**Starting a plan** (`/admin/billing` → Start performance plan): requires card on file (see setup-link warning in §2), then flips the split to 90/10, sets an hour-ceiled `billing_anchor`, and **immediately charges the $300** unless waived. Confirm dialog states this.

**Invoice lifecycle:** daily cron (9:00 UTC) drafts monthly invoices as `pending_review` → you review (optionally edit; edits block charging until saved) → **Charge** → `charging` → `paid` (terminal) or `failed`.

**Iron rules (violating these double-charges someone):**
- **Void before retry.** A retry always voids the prior Stripe invoice first (the code does this — don't work around it in the Stripe dashboard).
- **If a Charge click errors with a network/timeout message, WAIT for the webhook** before retrying — the charge may have succeeded.
- `paid` is terminal; `voided` rows stay in the chain on purpose.
- **Recompute discards manual edits** (it warns).

**Refunds/disputes:** handle in Stripe directly; the invoice row stays `paid` (the ledger records what was collected at the time).

---

## 7. Referral / affiliate program

- **/admin/referrers**: create partner (default share 20%) → assign brands (optional per-brand % override) → **Copy partner link** → send.
- Partner cut = share % × **collected (paid) invoice totals** from their brands. `pending` = drafted/failed invoices, settles on collection; voided never counts.
- The partner page (`/partner/<token>`) shows them exactly what you see, plus **View dashboard** links into each referred brand's `/share` view. What you owe each partner = the "earned" pill on their card. Payouts are manual (Zelle/wire/whatever) — there's no payout ledger yet, so keep receipts.

---

## 8. Case studies (sales collateral)

- Live at `/case-studies` — 10 published, **brands anonymized by category** (G FUEL is under NDA framing; don't name anyone without written permission).
- Data lives static in `src/lib/case-studies.ts`. To add one: pull the merchant's A/B window numbers (`eh_ab_test_window` + `hourly_funnel_rollups` + `eh_merchant_outlier_revenue`), verify the split is clean and z ≥ ~3, add an entry, build, push. **Never publish an open window's numbers without the "still running" footnote, and never publish a flat/negative result as a win** (Vitanics is flat — it stays unpublished).
- Every merchant's shareable proof links live on **/admin/links**.

---

## 9. Failure modes, ranked by frequency

1. **"Installed but not escaping"** → `async` on the script tag. Fix: remove async, bump `?v=`, verify `as:1` disappears from beacons. Not the IG version, not the scheme — it's the async bug. Always has been.
2. **Stale rollups** (dashboards flat since ~N hours) → retention cron missed. Health page → Roll up last 24h.
3. **Purchases = 0, impressions fine** → webhook 401 (wrong per-store secret) or wrong `shopify_domain`. Vercel logs for `webhooks/shopify/orders` show `bad_hmac` / `unknown_shop_domain`.
4. **"Dashboard shows zero"** → usually TRUE: brand went dark (stopped IG ads / removed tag). Health page catches it in <48h. Compare impressions-by-day cliff vs purchases continuing.
5. **"Meta says escapes underperform"** → attribution asymmetry (§5), not performance.
6. **Config flip "didn't work"** → 1h edge cache; bump `?v=`.

---

## 10. Access & env

- **Admin allowlist**: `src/lib/admin.ts` (`ADMIN_EMAILS`) — add the new teammate's email there (and create their Supabase auth user via normal signup) to grant admin.
- **Prod**: `getescapehatch.com`, Vercel project `escape-iab`, deploys on push to `main` (GitHub `CopywriterNull/escape-iab`).
- **Data**: Supabase project "Escape IAB" (`kfzhbkvbxzlsiqcgaoiw`). Sensitive env (service role, Stripe, `SITE_URL`) is Vercel-Production-only and NOT pullable — see `~/.claude` memory or ask Lenny.
- **Crons** (`vercel.json`): `/api/cron/retention` hourly :17 (includes rollup refresh), `/api/cron/billing` daily 9:00 UTC.

---

## 11. Doc map

| Doc | Status |
|---|---|
| `docs/OPERATIONS.md` | **Canonical** (this file) |
| `docs/attribution-symmetry-and-scale.md` | Current (2026-07-11) — attribution + scaling plan |
| `STYLE_GUIDE.md` | Current — design tokens for any new surface |
| `AGENTS.md` / `CLAUDE.md` | Current — Next 16 rule for AI agents |
| `MASTER.md`, `NOTES.md`, `HANDOFF.md` | **Frozen May 2026 — historical only, banners added** |
| `SUPABASE.md` | Half-current: measurement philosophy good; storage numbers stale |
| `docs/INSTALL_GFUEL.md`, `docs/AB_TESTING_PLAN.md` | Historical — use `/install/<id>` + `/admin/guides` instead |
