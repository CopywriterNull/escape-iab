# EscapeHatch — session handoff (2026-05-17)

Where we left off after a multi-day push to make andar.com escape correctly, harden the install surface, and add operator/QA tooling.

For the canonical state of the project (stack, schema, attribution architecture, known issues) **read `NOTES.md` first.** This doc is the live "what just happened + what's next" overlay.

> **2026-05-20 update (dashboard v2 + rollout measurement):** new `/dashboard/v2` route is live on `main` (commit `2dd17d1`). It is a denser, screenshot-ready variant of the overview built on top of the same loaders (`getTestFunnel`, `getSourceBreakdown`, `getUnattributedPurchaseStats`). The main dashboard is unchanged; a "Try v2 preview" chip on `/dashboard` links to it. New `SUPABASE.md` at repo root documents the Supabase/data-side work and — most importantly — the **100% rollout measurement model** (small holdout, test-locked baseline, pre/post). v2 surfaces this as a `PhaseStrip` panel that derives Testing / Ready to graduate / Rolled out from `ab_enabled` + significance + lift sign. The matching DB primitive (`merchant_test_baselines` to snapshot the winning B-RPV at graduation) is **not yet implemented** — that is the next durable step for true post-rollout estimated-lift.

> **2026-05-18 update:** parts of this handoff are stale. `0016_ab_split_pct.sql` is already applied in live Supabase, v10-era code is no longer sitting uncommitted, and the immediate dashboard issue was traced to RLS-hidden admin impersonation reads plus slow `escape_events` aggregates. See the top of `MASTER.md` and migration `0017_dashboard_perf_and_rls.sql`.

> **2026-05-19 update:** latest production work is pushed to `main`. Dashboard impersonation/settings data loading is fixed, homepage proof language now uses percentage lift/RPV lift instead of recovered-dollar framing, homepage escape counter uses all merchants over the last rolling 24h, and the early-access CTA is now a lead form posting to `/api/early-access`. The form forwards to `EARLY_ACCESS_WEBHOOK_URL`, which still needs to be set in Vercel once the webhook URL is available.

> **2026-05-19 report/ops update:** `/dashboard/report` is now the first client-report surface. It is still login/impersonation gated, but it packages the exact data we want to later expose through `/share/[token]`: validity status, RPV lift, CVR lift, projected revenue delta, funnel proof, source mix, and caveats. Shared validity math lives in `src/lib/test-validity.ts`. Admin overview/merchant/diagnostics event counts now use service-role-only summary RPCs from `supabase/migrations/0019_admin_summary_rpcs.sql` instead of pulling raw 24h event rows.

---

## 2026-05-20 session notes — dashboard v2 + rollout measurement

### What shipped (pushed to `main`, commit `2dd17d1`)

| File | Change |
| --- | --- |
| `src/app/dashboard/v2/page.tsx` | **NEW** — denser overview variant. Hero panel (incremental revenue + lift + confidence + rollout upside) + Porsche meter on top row, 4-up metric strip in the middle, A/B readout + source mix on the bottom. Reuses `getTestFunnel`, `getSourceBreakdown`, `getUnattributedPurchaseStats`, `zTestTwoProp`. Range pills link back to `/dashboard/v2?range=...`; a `Classic` link returns to `/dashboard`. |
| `src/app/dashboard/page.tsx` | Added `Try v2 preview` chip next to `Install snippet` in the page action area. Range is carried over via `?range=${range.key}`. |
| `SUPABASE.md` | **NEW** at repo root. Captures the data-side state (rollups, indexes, retention, attribution gaps) **and** the 100% rollout measurement model — see below. |

### Why v2 exists

User feedback: classic `/dashboard` has too much vertical white space and the Porsche revenue card felt isolated. v2 is the screenshot-ready compact variant for client decks. It is deliberately a parallel route, not a replacement — anything that wants to keep working should keep using `/dashboard`.

### `PhaseStrip` (v2-only)

Derived locally in `src/app/dashboard/v2/page.tsx`:

- **Testing** — `ab_enabled === true` and **not** statistically significant. Helper copy reinforces "bucket B is silent by design."
- **Ready to graduate** — `ab_enabled === true`, significant, positive RPV lift. Helper copy recommends a 90/10 or 95/5 holdout when flipping to rollout so live lift math stays honest.
- **Rolled out** — `ab_enabled === false`. Helper copy reframes the readout as "estimated incremental revenue vs locked baseline."

Today the strip is purely derived from current data. The "Rolled out" state still draws on live A/B deltas because we do not yet snapshot the winning test window.

### 100% rollout measurement — recommended approach

Documented in full in `SUPABASE.md` under `## 100% Rollout Measurement`. Short version, in order of preference:

1. **Small holdout (best).** Run 90/10 or 95/5 instead of true 100%. A = escape, B = holdout. Keep computing `(RPV A − RPV B) * A visitors` for realized incremental, and `(RPV A − RPV B) * all eligible visitors` for rollout upside. This is the cleanest way to keep proving lift over time.
2. **Test-locked baseline (good).** If the client insists on 100%, freeze the winning test window's B/control RPV/CVR/AOV in a new table and compute `estimated incremental revenue = (current escaped RPV − locked control RPV) * current eligible visitors`. Label as "estimated", not live A/B proof.
3. **Pre/post (backup).** Compare post-rollout performance to prior same-day / same-source history. Vulnerable to seasonality and creative mix — should not be presented as causal proof.

### What is NOT yet built

- No `merchant_test_baselines` table. Without it, the "Rolled out" PhaseStrip state cannot show a true estimated-lift number — it reuses live deltas as a stand-in. **This is the next durable step** if we want post-rollout proof to be honest.
- No dashboard control to "Lock baseline" / graduate a test. Today operators just flip `ab_enabled = false` in `/dashboard/settings`.
- No "Phase" indicator on the classic `/dashboard` (intentional — keeping it stable).

### Uncommitted work sitting next to this on `master`/`main`

Untouched by this session, but visible in `git status`:

- `src/app/admin/_components/sidebar-nav.tsx`, `src/app/admin/diagnostics/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`
- `src/app/api/track/route.ts`
- `src/app/preview/landing/page.tsx` and new `src/app/preview/landing/{cto,signal}/`
- `src/app/admin/momentum/`
- `docs/audits/`
- `supabase/migrations/20260520164000_drop_legacy_eh_increment_rollup_4arg.sql`
- `supabase/.temp/`

These are someone else's in-flight changes and were **deliberately not bundled** into commit `2dd17d1`. Do not assume they relate to the dashboard work.

### Suggested next moves

1. **Add `merchant_test_baselines`** (id, merchant_id, locked_at, b_rpv, b_cvr, b_aov, control_visitors, source_scope, confidence, notes). Write a server action invoked from a new "Graduate test" button on `/dashboard/settings`. Update v2's PhaseStrip "Rolled out" branch to read from it.
2. **Add a `Testing | Ready | Rolled out` chip to `/dashboard/report`** so the client-facing readout matches what operators see on v2.
3. **Storage retention work** from `SUPABASE.md`: drop the `fbclid` index, replace raw user-agent retention with parsed fields, partition raw `escape_events` by month if volume keeps climbing.
4. **Decide v2's fate.** If the team likes it, either promote it to `/dashboard` and move classic to `/dashboard/classic`, or keep v2 as the client-facing screenshot route and leave `/dashboard` as the operator workspace.

---

## 2026-05-19 operator notes

### Merchant assignment / invites
- Current model is still one `merchants.user_id` owner per merchant.
- `/admin/merchants` can **Claim for myself** only when a merchant is unowned. That assigns the merchant to the currently logged-in admin user.
- `/admin/merchants` can **View as** any merchant through the impersonation cookie.
- There is **not yet** an "invite by email" or "assign to another user" UI.
- Manual workaround: after the target person logs in once, copy their Supabase Auth `user.id` and update `public.merchants.user_id` for the merchant.
- Gotcha: `src/app/auth/callback/route.ts` auto-creates a blank merchant for first-time users who do not already own one. A proper invite flow should detect pending invites and attach the invited merchant instead of creating a blank row.

### Public / password-protected merchant share page
Yes, this is doable. Recommended shape:
- Add a public share route like `/share/[token]` that reuses the `/dashboard/report` data/model.
- Store share settings in a new table, e.g. `merchant_share_links` with `merchant_id`, `token_hash`, `enabled`, optional `password_hash`, optional `expires_at`, and allowed date range.
- The public page should show a read-only, simplified version of dashboard metrics. Avoid raw event rows, install controls, settings, merchant IDs, or admin actions.
- For password protection, require a password once, then set an httpOnly short-lived cookie scoped to that share route.
- For sales calls, a faster v1 could be a Vercel-protected preview route or a single password from env, but per-merchant share links are cleaner and safer.

### Early access form
- `src/components/EarlyAccessForm.tsx` collects work email, brand, website, monthly visitors, storefront platform, and notes.
- `src/app/api/early-access/route.ts` validates fields and forwards JSON to `process.env.EARLY_ACCESS_WEBHOOK_URL`.
- Until `EARLY_ACCESS_WEBHOOK_URL` is set in Vercel and redeployed, submissions return `webhook_not_configured`.

---

## ✅ What's working

### IG/Threads `extbrowser` scheme is alive
Proven by `src/app/layout.tsx` (lines 78–104) — our own marketing site uses `instagram://extbrowser/?url=...` via `<Script strategy="beforeInteractive">` and escapes successfully today. The scheme itself is not patched; failure modes always trace to how the snippet is loaded.

### G FUEL is in steady-state prod
- Snippet installed sync (no `async`), pixel connected, Shopify Order webhook routing to the right merchant.
- First merchant ID: `8b6e80c0-88fd-4c9e-acab-39e21e6d7154`.

### Admin/operator tooling
- `/admin/merchants` — list, rename, set `shopify_domain`, install snippet, impersonate.
- `/admin/diagnostics` — per-merchant config snapshot (LIVE/KILLED, PAID/ALL, A/B, fallback) + last-24h event counts.
- `/admin/guides` — 8 playbooks covering: sync-script pitfall, cache busting, kill switch, paid-only, multi-tenant webhook, pixel setup, `?eh_force=a|b` QA, full QA checklist.
- Impersonation hardened: UUID-shape guards on every admin write, hidden `merchant_id` cross-check in the settings form, persistent "Editing as admin: NAME · DOMAIN · ID" cobalt banner during impersonation. Cannot accidentally rename / save to the wrong row.

### Settings + dashboard
- `/dashboard/settings` honors impersonation; "Editing as admin" banner shows which row is being written; ?saved=1 success banner with cache-bust reminder.
- A/B testing toggle works; 100% escape when off.
- `paid_only` default is **false** (migration 0015) — every IG/Threads IAB visitor bucketed, not just paid clicks.
- `escape_enabled` kill switch (impressions still beacon, redirect skipped).

### Lander
- Dark mode default. `/preview/landing/next` mounts `<Lander variant="v2" />` (cobalt PREVIEW ribbon). Section order in v1: Hero → HowItWorks → Platforms → Problem → Comparison → CaseStudy → DashboardPreview → Features → ABCallout → SnippetPreview → Pricing → FAQ. Pricing floor $300 (Pro = "starts here", Scale $900, Enterprise Custom). FAQ rewritten platform-agnostic.

---

## ⚠️ What just shipped to disk but **NOT deployed yet**

These are the uncommitted changes sitting on master locally. None of them are live on Vercel:

| File | Change |
| --- | --- |
| `src/lib/snippet.ts` | **v10:** async self-diagnostic (`as:1` beacon flag + console.warn); `?eh_force=a|b` QA bypass (`forced:1` beacon flag, no cookie writes); `SPLIT` constant for configurable A/B split |
| `src/app/s/[merchantId]/route.ts` | reads `ab_split_pct` from `merchants`, clamps to [1, 99], passes to builder |
| `src/app/actions/merchant.ts` | parses + clamps `ab_split_pct` form field, writes to DB |
| `src/app/dashboard/settings/page.tsx` | renders `<SplitSlider />` under the A/B toggle |
| `src/app/dashboard/settings/_components/split-slider.tsx` | **NEW** client component — range slider with live A/B readout, accent fill bar, quick-set chips, 50/50 reset |
| `src/app/dashboard/install/page.tsx` | **CRITICAL FIX** — generated tag dropped `async`, added red "no async" callout in UI |
| `src/app/admin/guides/page.tsx` | new `?eh_force=a|b` guide entry |
| `src/lib/db.ts` | `Merchant.ab_split_pct?: number` typed |
| `docs/INSTALL_GFUEL.md` | removed `async` from example, added no-async warning |
| `NOTES.md` | new "Recurring incident: snippet installed with async" section + v10 contract note |
| `supabase/migrations/0016_ab_split_pct.sql` | **NEW** migration — adds `ab_split_pct INT NOT NULL DEFAULT 50 CHECK (between 1 and 99)` |

### Deploy steps (in order)

1. **Apply migration 0016 in Supabase SQL Editor.** Without it, the `ab_split_pct` column doesn't exist, the snippet route falls back to 50 (defensive `Number.isFinite`), and the settings save throws a Postgres error.
2. **`git push`** — Vercel auto-deploys, ~2 min.
3. **Verify v10 is live:**
   ```bash
   curl -s 'https://getescapehatch.com/s/b8596aac-0c87-4616-80c1-4bdfddf54ad8.js?v=20verify' \
     | grep -oE '"v10"|forced:|SPLIT|eh_force'
   ```
   Expect `"v10"` + `forced:` + `eh_force` matches.
4. **Test `?eh_force=a`** from inside Instagram on the test phone:
   ```
   https://www.andar.com/?eh_force=a
   ```
   Should escape to Safari every time, no bucket roulette.

---

## ❌ What didn't work / open issues

### Andar.com escape still being validated end-to-end
- DB events were reset (`escape_events` + `daily_rollups` for `b8596aac-0c87-4616-80c1-4bdfddf54ad8` truncated).
- AB was toggled off, then back on. Bucket roulette during testing makes "is it working?" hard to verify without `?eh_force=a` (which is the v10 feature pending deploy).
- Webhook + Customer Events pixel are installed per user, but not yet verified end-to-end with a real test order. **Do this after v10 deploy.**

### Install-surface template drift (structural risk, unmitigated)
The `<script>` install tag is hand-written in **5 places**: `/install/[id]`, `/admin/merchants`, `/admin/guides`, `/dashboard/install`, `docs/INSTALL_GFUEL.md`. The recurring `async` bug came from drift between these. They're all aligned now, but the next refactor can re-introduce drift. **Right fix: extract one `src/lib/snippet-tag.ts` helper, every surface imports it.** Not done yet.

### `forced:1` not persisted to DB
The `?eh_force=a|b` flag is stamped on the beacon wire (visible in Vercel runtime logs, useful for live QA debugging) but `escape_events` doesn't have a `forced boolean` column yet, so QA traffic still pollutes dashboard metrics. Two-line follow-up: migration + insert-side update in `/api/track/route.ts:116`.

### Operator UI gaps
- `/admin/diagnostics` doesn't show the configured `ab_split_pct` — operators see LIVE/KILLED/PAID/ALL/AB on/off but not the split percentage. Worth adding a column.
- `/admin/merchants` doesn't show split either — only flags via the inline forms.

### Initial andar debugging dismissed user evidence
For ~30 min I insisted "snippet not in HTML" based on `curl ?em-bypass=server` returning empty greps, while user kept saying "it's literally in there." User was right — I missed it in the paste. The actual root cause was `/dashboard/install` generating tags with `async`. **Lesson: when user says they can see X in their browser, trust that and pivot to "why doesn't it work even though it's there" instead of arguing about presence.** Saved to memory (`project_escapehatch.md`).

---

## 🎯 Recommended next-session priorities

1. **Deploy v10 + apply 0016** (see steps above) — unblocks everything else.
2. **End-to-end QA on andar:** clear site data on test phone → hit `https://www.andar.com/?eh_force=a` from IG → expect Safari handoff → buy something with a $0.01 test code → verify `/api/track` logs show `impression` (IAB side), `impression` (Safari side), `cart_check`, then webhook fires with `order paid` + `cart_token` → verify dashboard shows the purchase attributed to bucket A.
3. **Test the split slider** — drag to 70 on andar, save, curl the served JS, confirm `Math.random()<0.70` in the compiled body.
4. **Add `forced` column + insert-side** to `escape_events` so dashboards can filter QA traffic out (~10 lines + migration).
5. **Refactor install tag template to single source** (`src/lib/snippet-tag.ts`) — kills the recurring async-drift bug structurally.
6. **Surface `ab_split_pct` in `/admin/diagnostics` and `/admin/merchants`** so operators see the split per merchant at a glance.

### Stretch / nice-to-haves
- Stripe Checkout wired to the "Get early access" form for self-serve $300 signup.
- Pre-fill `/login` form with `?email=` query param.
- Weekly email digest to merchants.
- Approve v2 lander at `/preview/landing/next` and flip prod `/app/page.tsx` to `variant="v2"`.

---

## 🧠 Operating principles that came out of this session

- **The install snippet tag must run synchronously.** No `async`, no `defer`. The IG WebView commits to rendering on a tight schedule; if our `location.replace(instagram://extbrowser/...)` fires after `didCommit`, the scheme is silently dropped. This is the recurring failure mode. Snippet v10 self-diagnoses it (`as:1` beacon + `console.warn`).
- **Snippet flags are baked at GET time, behind a 5-min edge cache.** Any DB toggle (`ab_enabled`, `paid_only`, `escape_enabled`, `ab_split_pct`) requires bumping `?v=` on the install tag to propagate quickly. The dashboard "Saved" banner reminds operators of this.
- **Trust the user's browser view over your curl output.** Edgemesh/CDN/region effects can make `curl` and a real browser disagree about what HTML is served. When they conflict, debug the discrepancy — don't dismiss the browser view.
- **Bucket B is silent by design — don't confuse it with broken.** With AB on, 50% of test population is silent control. QA tests look "broken" until you clear cookies and re-roll, or use `?eh_force=a`.

---

## 📋 Continuation prompt (paste into next session)

> I'm working on EscapeHatch (https://github.com/CopywriterNull/escape-iab), a SaaS that escapes Instagram/Threads in-app browser for Shopify merchants. Repo at `~/Desktop/escape-iab`. Prod at `https://getescapehatch.com`.
>
> **Read in this order before doing anything:** `HANDOFF.md` (live what-just-happened) → `MASTER.md` (top-of-doc status snapshot) → `SUPABASE.md` (data state + how to report value post-rollout) → `NOTES.md` only if you still need canonical architecture. Don't re-derive what's already documented.
>
> Recent state (2026-05-20):
> - `/dashboard/v2` is live as a denser, screenshot-ready overview variant. Classic `/dashboard` is unchanged. A "Try v2 preview" chip links between them.
> - v2 includes a `PhaseStrip` panel (Testing / Ready to graduate / Rolled out) driven by `ab_enabled` + significance + lift sign.
> - `SUPABASE.md` is the canonical reference for the 100% rollout measurement model (small holdout → test-locked baseline → pre/post). The `merchant_test_baselines` table that would make the "Rolled out" branch honest **does not exist yet**.
> - There are other in-flight changes sitting uncommitted in `git status` (admin sidebar/diagnostics/layout, `api/track/route.ts`, preview landing pages, `admin/momentum/`, `docs/audits/`, a drop-legacy-RPC migration). They are someone else's stream — do not bundle them into v2-related commits.
>
> Top priorities (do in order):
>
> 1. **Add `merchant_test_baselines`** (id, merchant_id, locked_at, b_rpv, b_cvr, b_aov, control_visitors, source_scope, confidence, notes). Server action invoked from a new "Graduate test" button on `/dashboard/settings`. Update v2's PhaseStrip "Rolled out" branch to read estimated lift from it.
> 2. **Mirror the phase chip on `/dashboard/report`** so the client-facing readout matches what operators see on v2.
> 3. **Storage retention work from `SUPABASE.md`**: drop the `fbclid` index, replace raw user-agent retention with parsed fields, consider monthly partitioning for raw `escape_events`.
> 4. **Decide v2's fate.** Either promote it to `/dashboard` and move classic to `/dashboard/classic`, or keep v2 as the client-facing screenshot route and leave classic for operators.
>
> Don't migrate frameworks, don't break the existing A/B data flow, verify routes return 200 after meaningful changes, and run `npx tsc --noEmit` after multi-file edits. Touched dashboard files must pass lint; the full repo lint still fails on unrelated older issues so don't chase those.
