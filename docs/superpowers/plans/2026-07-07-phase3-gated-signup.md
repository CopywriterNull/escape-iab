# Phase 3 — Gated Self-Serve Signup + Approval Queue + Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prospects can sign up self-serve (Google or magic link → onboarding form → pending workspace), see a pending-approval experience with a product preview, and go live when an admin approves them from the /admin/merchants queue (with a "you're in" email) — replacing the removed implicit account creation.

**Architecture:** `merchants.status` (`live | pending`) gates the dashboard: pending merchants render a dedicated approval-pending screen (static demo preview + inert install snippet) instead of the live dashboard. `/signup` authenticates first (reusing `LoginForm`, which gains a Google OAuth button), then a service-role server action creates the pending merchant + owner membership atomically-with-cleanup. The admin queue approves (status→live, `escape_enabled`→true, Resend approval email) or rejects (delete, FK cascades). Phase 2 carry-forwards ship first as a chore task: `React.cache()` on `getCurrentMerchant`/`getCurrentRole`, a shared `siteOrigin()` helper with empty-string guard, and the team-page email-reflection guard.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS + Google OAuth provider), Resend REST API (existing `src/lib/email.ts` pattern), Tailwind 4 CSS variables.

**Spec:** `docs/superpowers/specs/2026-07-06-customer-dashboard-rehaul-design.md` §2 (auth flow, Google OAuth), §6 (gated signup). Phases 1-2 are live: membership RLS, `getCurrentRole`, `/dashboard/team`, `/invite/[token]`, Resend invite emails.

**Deliberate scoping decisions (note in final summary):**
- **Reject = delete** (spec §6 says "mark rejected / delete"; there is no `rejected` status in the spec's §1 enum, so delete is the consistent choice; FK cascades clean up memberships/invitations). Reject only acts on `status = 'pending'` rows — live merchants keep the existing Delete affordance.
- **Pending experience = dedicated screen** with a static sample-metrics preview and the merchant's real (inert) install snippet — not the full dashboard threaded with demo data. The full-dashboard demo treatment belongs to the Phase 4 visual rehaul, which restyles every screen anyway.
- **Pending merchants are created with `escape_enabled = false`** (existing kill-switch semantics) so the hosted snippet `/s/[id].js` stays inert until approval flips it on ("no live config", spec §6).
- **Google OAuth ships as code + manual checklist prereq**: the "Continue with Google" button calls `signInWithOAuth`; enabling the Google provider (Google Cloud OAuth client + Supabase dashboard config) is an external one-time setup. Until enabled, the button surfaces Supabase's error inline and magic link still works.
- **Double-submit disabled states on forms** stay deferred to the Phase 4 UI pass (Phase 2 final-review triage).

## Global Constraints

- Work directly on `main`; commit + push after **every** task (`gh auth switch -u CopywriterNull` if push 403s).
- Never `git add -A` / `git add .` — stage specific files (the tree has unrelated uncommitted WIP).
- Migrations apply to production via the Supabase MCP `apply_migration` (project id `kfzhbkvbxzlsiqcgaoiw`); keep `supabase/migrations/` + `supabase/schema.sql` in sync.
- `merchants.status` is exactly `live | pending`, default/backfill `live` (spec §1). Roles remain `owner | member | viewer`.
- `/admin` stays gated by the email allowlist; only the approval queue is added to it (no admin redesign).
- Admin allowlist emails act as owner everywhere; admins (and admin impersonation) must still see the REAL dashboard for pending merchants — the pending screen is for the merchant's own users.
- All merchant/membership writes go through the service-role client in server actions after auth checks; emails are best-effort and never block the action (Phase 2 pattern).
- No test framework — verification is `npm run build` + SQL probes via Supabase MCP. Browser-login checks are deferred: append them to `.superpowers/sdd/manual-checklist.md`.
- Next.js 16 — read `node_modules/next/dist/docs/` before writing unfamiliar Next.js code (AGENTS.md). `searchParams`/`params` are Promises in page props.
- RLS probes: never `count(*)` over `escape_events` under an authenticated role.
- Env (all with graceful degradation): `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_SITE_URL`.

---

### Task 1: Migration — `merchants.status` + `merchants.platform`

**Files:**
- Create: `supabase/migrations/20260707120000_merchant_status_gated_signup.sql`
- Modify: `supabase/schema.sql` (append the same DDL at the end)

**Interfaces:**
- Consumes: existing `public.merchants` table.
- Produces: `merchants.status text not null default 'live' check (status in ('live','pending'))`; `merchants.platform text` (nullable — captured at signup for admin triage).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260707120000_merchant_status_gated_signup.sql`:

```sql
-- Phase 3: gated self-serve signup.
-- status powers the approval gate: self-serve signups start 'pending' and
-- render the approval-pending experience until an admin flips them 'live'
-- from the /admin/merchants queue. Existing merchants backfill to 'live'
-- via the column default (NOT NULL + DEFAULT is metadata-only in PG 11+).
alter table public.merchants
  add column if not exists status text not null default 'live'
    check (status in ('live', 'pending'));

-- Storefront platform captured by the onboarding form (shopify /
-- woocommerce / custom / other) so the admin queue can triage installs.
-- Nullable: pre-Phase-3 merchants never filled it in.
alter table public.merchants
  add column if not exists platform text;
```

- [ ] **Step 2: Append the same DDL to `supabase/schema.sql`**

Append the full migration content to the end of `supabase/schema.sql`, preceded by the line:
`-- ── Phase 3: merchant status + platform (20260707120000) ──`

- [ ] **Step 3: Apply to production via Supabase MCP**

`mcp__claude_ai_Supabase__apply_migration` with project id `kfzhbkvbxzlsiqcgaoiw`, name `merchant_status_gated_signup`, the migration SQL as query. (If dispatched as a subagent without MCP access, skip and report — the controller applies it.)

- [ ] **Step 4: Verify in production via MCP `execute_sql`**

```sql
select
  count(*) as total,
  count(*) filter (where status = 'live') as live,
  count(*) filter (where status = 'pending') as pending
from public.merchants;
```

Expected: `total = live` (every existing merchant backfilled to `live`), `pending = 0`.

- [ ] **Step 5: Build + commit + push**

```bash
npm run build   # no app change yet; must stay green
git add supabase/migrations/20260707120000_merchant_status_gated_signup.sql supabase/schema.sql
git commit -m "feat: merchants.status (live/pending) + platform column for gated signup"
git push
```

---

### Task 2: Carry-forward chore — request caching, `siteOrigin()`, banner guard

**Files:**
- Create: `src/lib/site.ts`
- Modify: `src/lib/db.ts` (wrap `getCurrentMerchant` + `getCurrentRole` in `React.cache()`)
- Modify: `src/app/actions/team.ts` (use shared `siteOrigin`)
- Modify: `src/app/dashboard/team/page.tsx` (use shared `siteOrigin`; guard `sp.email` reflection)

**Interfaces:**
- Consumes: existing `getCurrentMerchant`/`getCurrentRole` bodies, `brand` from `@/lib/branding`.
- Produces: `src/lib/site.ts`: `export function siteOrigin(): string`. `getCurrentMerchant`/`getCurrentRole` keep their exact signatures (`() => Promise<Merchant | null>`, `(merchant: Merchant) => Promise<MemberRole | null>`) — only the memoization wrapper changes, so no caller changes anywhere.

- [ ] **Step 1: Create `src/lib/site.ts`**

```ts
import { brand } from "@/lib/branding";

/** Canonical public origin for links we mint (invite accept URLs, emails).
 *  `||` (not ??) deliberately: an empty-string NEXT_PUBLIC_SITE_URL is a
 *  known failure mode in this repo and must still fall back to prod. */
export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || `https://${brand.domain}`;
}
```

- [ ] **Step 2: Cache the two resolvers in `src/lib/db.ts`**

Change the `getCurrentMerchant` declaration from:

```ts
export async function getCurrentMerchant(): Promise<Merchant | null> {
```

to:

```ts
/** Request-cached: layout + page + server actions all resolve the same
 *  merchant in one request; cache() collapses the repeated auth.getUser
 *  and merchants reads. Caching this also makes the returned object
 *  reference-stable, which is what lets cache() dedupe getCurrentRole
 *  (its cache key is the merchant argument's identity). */
export const getCurrentMerchant = cache(async (): Promise<Merchant | null> => {
```

and close the function body with `});` instead of `}`. The body stays byte-identical.

Change the `getCurrentRole` declaration from:

```ts
export async function getCurrentRole(merchant: Merchant): Promise<MemberRole | null> {
```

to:

```ts
export const getCurrentRole = cache(async (merchant: Merchant): Promise<MemberRole | null> => {
```

and close with `});`. Body byte-identical. (`cache` is already imported in db.ts for `getMemberships`.)

- [ ] **Step 3: Use shared `siteOrigin` in `src/app/actions/team.ts`**

Delete the local helper:

```ts
function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://getescapehatch.com";
}
```

and add to the imports:

```ts
import { siteOrigin } from "@/lib/site";
```

- [ ] **Step 4: Use shared `siteOrigin` + guard the banner in `src/app/dashboard/team/page.tsx`**

Delete the local `siteOrigin` function (same body as above) and add `import { siteOrigin } from "@/lib/site";`.

Add near the top of the file (module scope, below the type definitions):

```ts
// Reflected into the banner from the query string — only render values
// that actually look like an email so a crafted link can't put arbitrary
// attacker-chosen text inside a trusted banner.
const BANNER_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

and change the banner's email suffix from:

```tsx
          {sp.email ? <span className="font-mono text-[12px]"> ({sp.email})</span> : null}
```

to:

```tsx
          {sp.email && BANNER_EMAIL_RE.test(sp.email) ? (
            <span className="font-mono text-[12px]"> ({sp.email})</span>
          ) : null}
```

- [ ] **Step 5: Build + commit + push**

```bash
npm run build
```

Expected: clean compile (signatures unchanged, so no caller edits needed).

```bash
git add src/lib/site.ts src/lib/db.ts src/app/actions/team.ts src/app/dashboard/team/page.tsx
git commit -m "chore: request-cache merchant/role resolvers, shared siteOrigin, banner guard"
git push
```

---

### Task 3: Google OAuth button on `LoginForm`

**Files:**
- Modify: `src/app/login/login-form.tsx`

**Interfaces:**
- Consumes: existing `LoginForm({ initialEmail, next })` props and `getSupabaseBrowser()`.
- Produces: no signature change — the Google button appears everywhere `LoginForm` renders (/login, /invite/[token], and Task 4's /signup) and threads the same `next` param through `/auth/callback`.

- [ ] **Step 1: Add the Google sign-in handler and button**

In `src/app/login/login-form.tsx`, inside the `LoginForm` component (below the existing `onSubmit` function), add:

```tsx
  async function onGoogle() {
    setError(null);
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError("Backend not configured.");
      return;
    }
    // OAuth also lands on /auth/callback with a ?code= — the same PKCE
    // exchange as magic links, so the callback route needs no changes.
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${
          next ? `?next=${encodeURIComponent(next)}` : ""
        }`,
      },
    });
    // On success the browser navigates away; only errors reach here
    // (e.g. provider not enabled in Supabase yet).
    if (err) setError(err.message);
  }
```

Then, in the returned JSX, wrap the existing `<form ...>...</form>` and the new block below in a fragment (`<>...</>`) so they render as siblings — the Google section goes immediately AFTER the closing `</form>` tag, outside the form:

```tsx
      <div className="mt-4">
        <div className="flex items-center gap-3 text-[10.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
          <span className="h-px flex-1 bg-[var(--color-border-soft)]" />
          or
          <span className="h-px flex-1 bg-[var(--color-border-soft)]" />
        </div>
        <button
          type="button"
          onClick={onGoogle}
          className="mt-4 w-full px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] text-sm font-medium press focus-ring inline-flex items-center justify-center gap-2.5 hover:bg-[var(--color-card)] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </div>
```

Note: the "sent" success state early-returns before the form renders — the Google button correctly disappears once a magic link is sent. Nothing else in the file changes; the no-prop `/login` call path is unaffected.

- [ ] **Step 2: Build + commit + push**

```bash
npm run build
git add src/app/login/login-form.tsx
git commit -m "feat: Continue with Google on login form (magic link + OAuth)"
git push
```

---

### Task 4: Approval email + shared Resend transport

**Files:**
- Modify: `src/lib/email.ts`

**Interfaces:**
- Consumes: existing `SendResult`, `fromAddress()`, `escapeHtml()`, `RESEND_ENDPOINT`; `siteOrigin` from Task 2.
- Produces: `sendApprovalEmail(opts: { to: string; merchantName: string }): Promise<SendResult>`; internal `postResendEmail(to: string, subject: string, html: string): Promise<SendResult>` (not exported). `sendInviteEmail` keeps its exact existing signature.

- [ ] **Step 1: Extract the shared transport and add the approval email**

In `src/lib/email.ts`, add `import { siteOrigin } from "@/lib/site";` at the top. Then replace the `try { ... }` fetch block inside `sendInviteEmail` (from `try {` through the closing `}` of the `catch`) with a call to the shared helper:

```ts
  return postResendEmail(opts.to, subject, html);
```

and add these two functions at the bottom of the file (above `escapeHtml`):

```ts
/** Shared Resend REST transport. Best-effort by contract: every failure
 *  mode returns { sent: false } — callers decide how to degrade. */
async function postResendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not set" };
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      console.error("[postResendEmail] resend error", res.status, body);
      return { sent: false, error: `resend ${res.status}` };
    }
    return { sent: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    console.error("[postResendEmail] fetch failed", msg);
    return { sent: false, error: msg };
  }
}

/** "You're in" email sent when an admin approves a pending workspace. */
export async function sendApprovalEmail(opts: {
  to: string;
  merchantName: string;
}): Promise<SendResult> {
  const dashboardUrl = `${siteOrigin()}/dashboard`;
  const subject = `You're in — ${opts.merchantName} is live on ${brand.name}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
    <div style="font-size:15px;font-weight:600;margin-bottom:24px">${brand.name}</div>
    <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(opts.merchantName)} is approved</h1>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 20px">
      Your workspace is live. Install the snippet from your dashboard and
      you'll start recovering Instagram checkout revenue within the hour.
    </p>
    <a href="${dashboardUrl}"
       style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
      Open your dashboard
    </a>
  </div>`;
  return postResendEmail(opts.to, subject, html);
}
```

Since `sendInviteEmail` now delegates its API-key check to `postResendEmail`, delete the now-redundant early return at the top of `sendInviteEmail`:

```ts
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not set" };
```

- [ ] **Step 2: Build + commit + push**

```bash
npm run build
git add src/lib/email.ts
git commit -m "feat: approval email + shared resend transport"
git push
```

---

### Task 5: `/signup` page + `createPendingMerchant` action

**Files:**
- Create: `src/app/actions/signup.ts`
- Create: `src/app/signup/page.tsx`
- Modify: `src/app/dashboard/layout.tsx` (no-workspace card links to /signup)

**Interfaces:**
- Consumes: `LoginForm({ initialEmail?, next? })`, `getMemberships()`, `ACTIVE_MERCHANT_COOKIE`, `getSupabaseServer`/`getSupabaseAdmin`, `brand`, `signOut`, Task 1's `status`/`platform` columns.
- Produces: `createPendingMerchant(formData: FormData): Promise<void>` server action; `/signup` route. Task 7's queue displays what this action writes (`status='pending'`, `platform`, `user_id`, owner membership).

- [ ] **Step 1: Create `src/app/actions/signup.ts`**

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ACTIVE_MERCHANT_COOKIE, getMemberships } from "@/lib/db";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";

const PLATFORMS = ["shopify", "woocommerce", "custom", "other"] as const;

export async function createPendingMerchant(formData: FormData) {
  const supabase = await getSupabaseServer();
  if (!supabase) redirect("/signup?err=no_backend");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  // One workspace per self-serve signup: users who already belong
  // somewhere go to their dashboard instead of minting another
  // pending merchant on a double-submit or revisit.
  const memberships = await getMemberships();
  if (memberships.length > 0) redirect("/dashboard");

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase().slice(0, 120);
  const platformRaw = String(formData.get("platform") ?? "");
  const platform = (PLATFORMS as readonly string[]).includes(platformRaw)
    ? platformRaw
    : "other";
  if (!name || !domain) redirect("/signup?err=missing_fields");

  const admin = getSupabaseAdmin();
  if (!admin) redirect("/signup?err=no_backend");

  // status=pending routes the dashboard into the approval experience;
  // escape_enabled=false keeps the hosted snippet inert until approval.
  const { data: merchant, error } = await admin
    .from("merchants")
    .insert({
      name,
      domain,
      platform,
      plan: "free",
      ab_enabled: true,
      fallback_button: true,
      escape_enabled: false,
      status: "pending",
      user_id: user.id,
    })
    .select("id")
    .single();
  if (error || !merchant) {
    console.error("[createPendingMerchant] insert failed", error);
    redirect("/signup?err=create_failed");
  }

  const { error: memberError } = await admin.from("merchant_members").insert({
    merchant_id: merchant.id,
    user_id: user.id,
    role: "owner",
  });
  if (memberError) {
    // Membership is what grants access — a merchant row without one is
    // an orphan the user can never see. Roll it back and surface the error.
    console.error("[createPendingMerchant] membership failed", memberError);
    await admin.from("merchants").delete().eq("id", merchant.id);
    redirect("/signup?err=create_failed");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_MERCHANT_COOKIE, merchant.id as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/merchants");
  redirect("/dashboard");
}
```

- [ ] **Step 2: Create `src/app/signup/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/lib/branding";
import { getMemberships } from "@/lib/db";
import { supabaseConfigured, getSupabaseServer } from "@/lib/supabase/server";
import { createPendingMerchant } from "@/app/actions/signup";
import { LoginForm } from "@/app/login/login-form";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  missing_fields: "Brand name and store domain are both required.",
  create_failed: "Couldn't create your workspace — try again.",
  no_backend: "Backend not configured.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center px-5 py-16 mesh-bg grain relative">
      <div className="absolute inset-0 dotgrid opacity-30 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      <div className="relative w-full max-w-sm card-hi p-8">
        <Link href="/" className="inline-flex items-center gap-2.5 font-semibold tracking-tight focus-ring rounded-md">
          <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-lg" style={{ background: "var(--color-accent)" }}>
            <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14a8 8 0 1 0 8-8" />
              <path d="M14 4h6v6" />
              <path d="M20 4l-8 8" />
            </svg>
          </span>
          {brand.name}
        </Link>
        {children}
      </div>
    </div>
  );
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;

  if (!supabaseConfigured) {
    return (
      <Shell>
        <p className="mt-6 text-sm text-[var(--color-fg-dim)]">
          Supabase isn&apos;t configured yet — signup is unavailable in this environment.
        </p>
      </Shell>
    );
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase!.auth.getUser();

  // Step 1: authenticate (magic link or Google), landing back here.
  if (!user) {
    return (
      <Shell>
        <div className="mt-7">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
            Start free
          </div>
          <h1 className="mt-1 h-display text-3xl">Create your account</h1>
          <p className="mt-1.5 text-sm text-[var(--color-fg-dim)]">
            Sign in first — then tell us about your brand.
          </p>
        </div>
        <LoginForm next="/signup" />
      </Shell>
    );
  }

  // Already in a workspace → nothing to create here.
  const memberships = await getMemberships();
  if (memberships.length > 0) redirect("/dashboard");

  // Step 2: onboarding form → pending workspace.
  return (
    <Shell>
      <div className="mt-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          Almost there
        </div>
        <h1 className="mt-1 h-display text-3xl">Tell us about your brand</h1>
        <p className="mt-1.5 text-sm text-[var(--color-fg-dim)]">
          Signed in as <strong className="text-[var(--color-fg)]">{user.email}</strong>.
          Your workspace goes live once we approve it — usually within a business day.
        </p>
      </div>

      {err && ERRORS[err] ? (
        <div className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {ERRORS[err]}
        </div>
      ) : null}

      <form action={createPendingMerchant} className="mt-6 space-y-3">
        <label className="block">
          <span className="block text-xs text-[var(--color-fg-dim)] mb-1.5 font-medium">Brand name</span>
          <input
            type="text"
            name="name"
            required
            maxLength={80}
            placeholder="e.g. G FUEL"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-fg-muted)] focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-[var(--color-fg-dim)] mb-1.5 font-medium">Store domain</span>
          <input
            type="text"
            name="domain"
            required
            maxLength={120}
            placeholder="yourstore.com"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm font-mono placeholder:text-[var(--color-fg-muted)] focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-[var(--color-fg-dim)] mb-1.5 font-medium">Platform</span>
          <select
            name="platform"
            defaultValue="shopify"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus-ring"
          >
            <option value="shopify">Shopify</option>
            <option value="woocommerce">WooCommerce</option>
            <option value="custom">Custom storefront</option>
            <option value="other">Other</option>
          </select>
        </label>
        <button
          type="submit"
          className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          Create workspace
        </button>
      </form>
    </Shell>
  );
}
```

- [ ] **Step 3: Point the no-workspace card at /signup**

In `src/app/dashboard/layout.tsx`, inside the `if (!merchant)` card, change the actions row from:

```tsx
          <div className="mt-5 flex items-center justify-center gap-3 text-sm">
            <a href="mailto:lenny@getescapehatch.com" className="text-[var(--color-accent)] link-grow">
              Contact us →
            </a>
```

to:

```tsx
          <div className="mt-5 flex items-center justify-center gap-3 text-sm">
            <Link href="/signup" className="text-[var(--color-accent)] link-grow">
              Create a workspace →
            </Link>
            <a href="mailto:lenny@getescapehatch.com" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
              Contact us
            </a>
```

(`Link` is already imported in the layout.)

- [ ] **Step 4: Build + commit + push**

```bash
npm run build
```

Expected: clean compile; `/signup` in the route list.

```bash
git add src/app/actions/signup.ts src/app/signup/page.tsx src/app/dashboard/layout.tsx
git commit -m "feat: /signup gated self-serve onboarding (pending workspace + owner membership)"
git push
```

---

### Task 6: Pending-approval dashboard experience

**Files:**
- Create: `src/app/dashboard/_components/pending-approval.tsx`
- Modify: `src/lib/db.ts` (Merchant type gains `status`/`platform`)
- Modify: `src/app/dashboard/layout.tsx` (pending gate)

**Interfaces:**
- Consumes: `Merchant`, `signOut`, `brand`, Task 1's `status` column; layout's existing `isAdmin` const.
- Produces: `PendingApprovalScreen({ merchant, userEmail }: { merchant: Merchant; userEmail: string })` server component.

- [ ] **Step 1: Add the columns to the `Merchant` type in `src/lib/db.ts`**

Inside `export type Merchant = { ... }`, after the `escape_discord?: boolean;` line, add:

```ts
  /** live = normal dashboard; pending = gated-signup approval experience. */
  status?: "live" | "pending";
  /** Storefront platform captured at self-serve signup. */
  platform?: string | null;
```

- [ ] **Step 2: Create `src/app/dashboard/_components/pending-approval.tsx`**

```tsx
import type { Merchant } from "@/lib/db";
import { brand } from "@/lib/branding";
import { signOut } from "@/app/actions/auth";

/** Full-screen experience for status='pending' merchants: what the product
 *  does (static sample metrics — clearly labeled), their install snippet
 *  (inert until approval flips escape_enabled), and where they stand.
 *  Static markup on purpose — no live queries for unapproved workspaces. */
export function PendingApprovalScreen({
  merchant,
  userEmail,
}: {
  merchant: Merchant;
  userEmail: string;
}) {
  const snippet = `<script src="https://${brand.domain}/s/${merchant.id}.js?v=13"></script>`;
  const SAMPLE = [
    { label: "IG escape rate", value: "38.2%", hint: "of in-app visitors rerouted" },
    { label: "CVR lift (A vs B)", value: "+27%", hint: "escape bucket vs control" },
    { label: "Recovered revenue", value: "$12.4k", hint: "last 14 days, sample brand" },
  ];

  return (
    <div className="min-h-dvh grid place-items-center px-5 py-12 bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="w-full max-w-xl space-y-5">
        <div className="card-hi p-7">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-mono text-[var(--color-warn)]">
            <span className="size-1.5 rounded-full bg-[var(--color-warn)] animate-pulse" />
            Pending approval
          </div>
          <h1 className="mt-2 h-display text-3xl">
            {merchant.name ?? "Your workspace"} is in review
          </h1>
          <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
            We approve new brands within one business day. You&apos;ll get an
            email at <strong className="text-[var(--color-fg)]">{userEmail}</strong>{" "}
            the moment {merchant.domain ?? "your store"} goes live.
          </p>
        </div>

        <div className="card-hi p-7">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            What you&apos;ll see once you&apos;re live
          </div>
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            {SAMPLE.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] p-3.5"
              >
                <div className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
                  {s.label}
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight tnum">{s.value}</div>
                <div className="mt-0.5 text-[10.5px] text-[var(--color-fg-muted)]">{s.hint}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-mono text-[var(--color-fg-muted)]">
            Sample data from a live {brand.name} brand — your dashboard fills
            with your own traffic after install.
          </p>
        </div>

        <div className="card-hi p-7">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Get a head start — your install snippet
          </div>
          <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
            You can paste this into your theme now. It stays dormant and
            activates automatically the moment you&apos;re approved.
          </p>
          <pre className="mt-3 text-[11.5px] font-mono bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <p className="mt-2 text-[11px] font-mono text-[var(--color-fg-muted)]">
            Place as the first &lt;script&gt; in &lt;head&gt; — no async, no defer.
          </p>
        </div>

        <div className="flex items-center justify-between text-sm px-1">
          <a href="mailto:lenny@getescapehatch.com" className="text-[var(--color-accent)] link-grow">
            Questions? Contact us →
          </a>
          <form action={signOut}>
            <button type="submit" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Gate the layout**

In `src/app/dashboard/layout.tsx`, add the import:

```ts
import { PendingApprovalScreen } from "./_components/pending-approval";
```

and immediately AFTER the `if (!merchant) { ... }` block (before the `impersonationMismatch` computation), add:

```tsx
  // Gated signup: pending merchants get the approval experience instead of
  // the live dashboard. Admins (incl. impersonation) still see the real
  // dashboard so they can inspect a pending workspace before approving.
  if (merchant.status === "pending" && !isAdmin) {
    return <PendingApprovalScreen merchant={merchant} userEmail={user.email ?? ""} />;
  }
```

- [ ] **Step 4: Build + commit + push**

```bash
npm run build
git add src/app/dashboard/_components/pending-approval.tsx src/lib/db.ts src/app/dashboard/layout.tsx
git commit -m "feat: pending-approval dashboard experience for gated signups"
git push
```

---

### Task 7: Admin approval queue + approve/reject actions

**Files:**
- Modify: `src/app/actions/admin.ts` (add `approveMerchantAsAdmin`, `rejectMerchantAsAdmin`)
- Modify: `src/app/admin/merchants/page.tsx` (pending queue section + status in Row/select + PENDING pill)

**Interfaces:**
- Consumes: `requireAdmin()`, `revalidateMerchantSurfaces()`, `UUID_RE`, `getSupabaseAdmin`, `sendApprovalEmail` (Task 4), `eh_team_members` RPC (Phase 2), Task 1's `status`/`platform` columns.
- Produces: `approveMerchantAsAdmin(formData)`, `rejectMerchantAsAdmin(formData)` server actions.

- [ ] **Step 1: Add the two actions to `src/app/actions/admin.ts`**

Add the import at the top:

```ts
import { sendApprovalEmail } from "@/lib/email";
```

Then add below `assignMerchantToCurrentUser`:

```ts
/** Approve a pending (gated-signup) merchant: status → live, snippet
 *  un-killed, best-effort "you're in" email to every owner. */
export async function approveMerchantAsAdmin(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return;

  const { data: merchant } = await admin
    .from("merchants")
    .select("id, name, domain, status")
    .eq("id", id)
    .maybeSingle();
  if (!merchant || merchant.status !== "pending") return;

  const { error } = await admin
    .from("merchants")
    .update({ status: "live", escape_enabled: true })
    .eq("id", id)
    .eq("status", "pending");
  if (error) {
    console.error("[approveMerchantAsAdmin] update failed", { id, error });
    return;
  }

  // Email failures never undo the approval — the queue is the source of
  // truth and the owner still sees the live dashboard on next load.
  const { data: members } = await admin.rpc("eh_team_members", {
    p_merchant_id: id,
  });
  const owners = ((members ?? []) as { email: string | null; role: string }[]).filter(
    (m) => m.role === "owner" && m.email,
  );
  for (const owner of owners) {
    await sendApprovalEmail({
      to: owner.email as string,
      merchantName: merchant.name ?? merchant.domain ?? "your workspace",
    });
  }

  revalidateMerchantSurfaces(id);
}

/** Reject a pending merchant = delete it (spec §6 "mark rejected / delete";
 *  there is no rejected status in the schema). Scoped to status='pending'
 *  so this can never delete a live merchant — those use the existing
 *  Delete affordance. FK cascades remove memberships + invitations. */
export async function rejectMerchantAsAdmin(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return;

  await admin.from("merchants").delete().eq("id", id).eq("status", "pending");
  revalidateMerchantSurfaces(id);
}
```

- [ ] **Step 2: Add the queue to `src/app/admin/merchants/page.tsx`**

Extend the imports from `@/app/actions/admin` with `approveMerchantAsAdmin, rejectMerchantAsAdmin`.

Extend the `Row` type with:

```ts
  status: string | null;
  platform: string | null;
```

Extend the merchants select string to:

```ts
      .select("id, name, domain, shopify_domain, user_id, plan, escape_enabled, created_at, status, platform")
```

In the component body, after `const rows: Row[] = ...`, add:

```ts
  const pending = rows.filter((r) => r.status === "pending");
```

In the returned JSX, insert this section between the header `<div className="flex items-baseline ...">...</div>` and the `<form action={createMerchantAsAdmin} ...>` block:

```tsx
      {pending.length > 0 ? (
        <section className="rounded-2xl border border-[var(--color-warn)]/40 bg-[var(--color-card)] p-5 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-warn)]">
              Approval queue · {pending.length} pending
            </div>
          </div>
          <div className="space-y-2">
            {pending.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 flex-wrap rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-medium tracking-tight">{r.name ?? "(unnamed)"}</span>
                    <span className="text-[12px] font-mono text-[var(--color-fg-dim)]">{r.domain ?? "—"}</span>
                    {r.platform ? <span className="pill pill-muted">{r.platform.toUpperCase()}</span> : null}
                  </div>
                  <div className="mt-0.5 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
                    signed up {new Date(r.created_at).toLocaleDateString()} · {r.id.slice(0, 8)}…
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={impersonateMerchant}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border-soft)] hover:bg-[var(--color-bg-elev)] press transition-colors">
                      Inspect
                    </button>
                  </form>
                  <form action={approveMerchantAsAdmin}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-success)]/40 text-[var(--color-success)] hover:bg-[var(--color-success-soft)] press transition-colors">
                      Approve
                    </button>
                  </form>
                  <form action={rejectMerchantAsAdmin}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] press transition-colors">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
```

In `MerchantRow`'s summary pills (next to the `ESCAPE ON`/`DISABLED` pill), add:

```tsx
            {row.status === "pending" ? <span className="pill pill-warn">PENDING</span> : null}
```

- [ ] **Step 3: Build + commit + push**

```bash
npm run build
git add src/app/actions/admin.ts src/app/admin/merchants/page.tsx
git commit -m "feat: admin approval queue — approve (live + email) / reject (delete) pending merchants"
git push
```

---

### Task 8: Phase verification + manual checklist

**Files:**
- Modify: `.superpowers/sdd/manual-checklist.md` (append Phase 3 section)
- Modify: `.superpowers/sdd/progress.md` (phase outcome)

- [ ] **Step 1: Full build** — `npm run build`; expect `/signup` and existing routes clean.

- [ ] **Step 2: Prod SQL verification via Supabase MCP** (project `kfzhbkvbxzlsiqcgaoiw`)

```sql
select
  count(*) filter (where status = 'live') as live,
  count(*) filter (where status = 'pending') as pending,
  count(*) filter (where status is null) as nulls
from public.merchants;
```

Expected: `nulls = 0`; all pre-existing merchants `live`.

G FUEL regression probe (same as Phase 2): owner JWT sees exactly 1 merchant, their daily_rollups, 0 invitations.

- [ ] **Step 3: Append Phase 3 section to the manual checklist**

```markdown
# Phase 3 — Manual Browser Smoke Checklist

Prereqs (one-time, external):
- [ ] Google OAuth: create a Google Cloud OAuth client (authorized redirect
      URI = the Supabase callback shown under Auth → Providers → Google),
      then enable the Google provider in Supabase with those credentials.
      Until then the button shows Supabase's "provider is not enabled" error
      and magic link keeps working.
- [ ] Resend prereq from Phase 2 still applies (approval email uses it).

## 1. Self-serve signup loop
- [ ] Logged out, open /signup → sign in (magic link or Google) → lands back
      on /signup → onboarding form (brand, domain, platform) → submit →
      pending-approval screen renders (sample metrics + inert snippet).
- [ ] /admin/merchants shows the workspace in the approval queue with its
      platform pill; the merchant row shows a PENDING pill.
- [ ] Approve it → merchant flips live (+ approval email if Resend is
      configured) → refresh the signup user's dashboard → real (empty)
      dashboard renders, snippet route no longer kill-switched.
- [ ] Repeat with a second test signup and Reject → merchant disappears;
      the test user gets the "No workspace yet" card with a working
      "Create a workspace →" link back to /signup.

## 2. Google OAuth
- [ ] "Continue with Google" works on /login (existing user) and on an
      invite accept page (email must match the invited address).

## 3. Regressions
- [ ] Existing owner dashboard unchanged (status backfilled to live).
- [ ] Admin impersonating a PENDING merchant sees the real dashboard, not
      the pending screen.
- [ ] Invite flow from Phase 2 still works end-to-end.

## Cleanup after testing
```sql
delete from public.merchants where status = 'pending' and name like '%test%';
delete from public.merchant_members where user_id =
  (select id from auth.users where email = '<your-test-email>');
```
```

- [ ] **Step 4: Commit the plan file + push**

```bash
git add docs/superpowers/plans/2026-07-07-phase3-gated-signup.md
git commit -m "docs: phase 3 plan (gated signup + approval queue + google oauth)"
git push
```

- [ ] **Step 5: Update the progress ledger** with the phase outcome, then run the final whole-branch review per the executing skill.
