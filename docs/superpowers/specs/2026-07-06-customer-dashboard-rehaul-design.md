# Customer Dashboard Rehaul — Design

**Date:** 2026-07-06
**Status:** Approved

## Goal

Turn the internal-leaning dashboard into a customer-accessible product: multi-user
accounts with email invitations, roles, gated self-serve signup for prospects, and a
full visual rehaul of the customer-facing surface. Audience: brand-side stakeholders
(e.g. G FUEL team) and prospects/trials.

## Decisions made

- Read-only portal = **viewer role on the main dashboard**, not a separate portal.
- Auth = **magic link + Google OAuth** (no passwords).
- Self-serve signup is **gated**: accounts start `pending` until approved from /admin.
- Multi-user layer built on **Supabase membership tables** (no Clerk, no auth-native
  invites as the primary mechanism).
- Visual redesign = **full rehaul** of customer-facing pages; /admin keeps its look.

## 1. Data model (Supabase migrations)

### `merchant_members` (new)

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| merchant_id | uuid fk → merchants | |
| user_id | uuid fk → auth.users | |
| role | text | `owner` \| `member` \| `viewer` |
| created_at | timestamptz | |

Unique on `(merchant_id, user_id)`. This is the new source of truth for access; a
user may belong to multiple merchants.

**Backfill:** insert an `owner` row for every existing `merchants.user_id` so all
current accounts (incl. G FUEL) keep working identically. `merchants.user_id` is
retained as legacy for now; drop in a later cleanup once membership lookup is proven.

### `invitations` (new)

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| merchant_id | uuid fk → merchants | |
| email | text | invited address (lowercased) |
| role | text | role granted on accept |
| token | uuid | accept-link token |
| invited_by | uuid fk → auth.users | |
| status | text | `pending` \| `accepted` \| `revoked` \| `expired` |
| expires_at | timestamptz | created_at + 7 days |
| created_at / accepted_at | timestamptz | |

### `merchants.status` (new column)

`live` \| `pending`, backfilled to `live`. Powers the gated-signup approval state.
No separate signup_requests table (YAGNI).

## 2. Auth flow

- Enable **Google OAuth** provider in Supabase; `/login` adds "Continue with Google"
  alongside the existing magic-link form. Both land on `/auth/callback`.
- **Remove** the callback's auto-create-merchant-on-first-login behavior. Replace with
  membership resolution:
  1. Session established → look up `merchant_members` rows.
  2. Has membership → dashboard (active merchant from cookie, else first membership).
  3. Arrived via invite token → accept-invite flow (§3).
  4. No membership, no invite → signup/onboarding flow (§6).
- `getCurrentMerchant()` in `src/lib/db.ts` switches from the `merchants.user_id`
  lookup to a membership lookup + **active-merchant cookie** for multi-account users.
  Generalize the existing MerchantSwitcher (currently admin-only) for any user with
  more than one membership.
- Admin impersonation (`eh_imp_merchant_id` cookie) and the hardcoded admin email
  allowlist are **unchanged**.

## 3. Invitations

- New **`/dashboard/team`** page:
  - Member list with roles.
  - Pending invitations with resend / revoke.
  - Invite form (email + role).
  - Owner-only management; members see the list read-only; viewers have no team page.
- **Email delivery via Resend** (new dependency, free tier): branded invite email and
  "access approved" email. Supabase built-in SMTP is auth-template-only and
  rate-limited, so it is not used for invites.
- **Accept flow** at `/invite/[token]`:
  1. Logged out → login screen with the invited email prefilled (magic link or Google).
  2. Validate token: status `pending`, not expired, session email matches invited email.
  3. Create `merchant_members` row with the invited role; mark invitation `accepted`.
  4. Redirect to that merchant's dashboard.
- **Edge cases:**
  - Expired/revoked/consumed token → clear error page with "ask your admin to re-invite".
  - Inviting an email that is already a member → no-op with message.
  - Session email ≠ invited email → explain and offer sign-out.
  - **Last-owner protection:** cannot remove or demote the only owner of a merchant.

## 4. Roles & permissions

| Capability | Owner | Member | Viewer |
|---|---|---|---|
| View dashboard / reports | ✓ | ✓ | ✓ |
| Install page / snippet | ✓ | ✓ | — |
| Edit settings (A/B split, platforms, flags) | ✓ | — | — |
| Manage team & invitations | ✓ | — | — |

Enforcement in two layers:

1. **App layer (primary):** role checks in dashboard layout + every server action that
   mutates (settings updates, invites, member removal).
2. **RLS (backstop):** policies keyed on `merchant_members` (§5).

`/admin` remains gated by the existing email allowlist; roles do not grant admin.

## 5. RLS changes

Read policies on `merchants`, `daily_rollups`, `hourly_funnel_rollups`,
`escape_events`, `cart_attributions` change from "user_id owns merchant" to
"EXISTS a `merchant_members` row for (auth.uid(), merchant_id)". Write policies on
`merchants` (settings) require role `owner`. Telemetry ingest and admin operations
continue through the service-role client and are unaffected.

## 6. Self-serve signup (gated)

- New **`/signup`** page: Google or magic link → onboarding form (brand name, store
  domain, platform) → creates merchant with `status = 'pending'` + owner membership.
- **Pending state:** dashboard renders a "pending approval" experience — sample/demo
  data so prospects see the product, plus an install-docs preview. No live config.
- **`/admin/merchants` approval queue:** list pending merchants; approve (→ `live`,
  send "you're in" email via Resend) or reject (mark rejected / delete).
- The old implicit account creation on first login is fully replaced by this flow.

## 7. Visual rehaul

Full redesign of the customer-facing surface only, keeping Tailwind 4 + the existing
CSS-variable theme system (no component library):

- New dashboard shell: sidebar/nav, header with merchant switcher + user menu.
- Redesigned KPI cards, funnel, source tables, daily chart treatments.
- Proper empty / loading / pending-approval states.
- Redesigned `/login`, new `/signup`, `/invite/[token]`, `/dashboard/team`.
- Exec-presentable polish per high-end design standards.
- `/admin` keeps its current look; only the approval queue is added.

## 8. Phasing

1. **Tenancy foundation** — tables, backfill, membership-based auth, RLS. Success =
   invisible: existing dashboards behave identically (verify against G FUEL live data).
2. **Invites + team page + roles.**
3. **Gated self-serve signup** + admin approval queue + Resend emails.
4. **Visual rehaul** — last, so final screens are styled once.

Each phase ships independently (commit + push per workflow).

## Testing

Manual verification checklist per phase, plus `next build` type-checks throughout:

- Login via magic link and via Google; session persists; sign-out.
- Backfilled owner sees identical dashboard data pre/post migration.
- Invite: send, accept (new user + existing user), resend, revoke, expiry, wrong-email.
- Role gating: viewer blocked from settings/install/team; member blocked from
  settings/team; last-owner protection.
- Signup: pending merchant created, demo-data dashboard renders, admin approve flips
  to live and sends email, reject path.
- RLS: user without membership cannot read another merchant's rows (query as user).

## Out of scope

- Billing / plans / Stripe.
- Separate exec portal (viewer role covers it; revisit later if needed).
- Changes to snippet, telemetry ingest, rollup jobs, or Shopify webhooks.
- Admin UI redesign.
