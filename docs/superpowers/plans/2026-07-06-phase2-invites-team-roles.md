# Phase 2 — Invites + Team Page + Role Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners can invite teammates by email with a role (owner/member/viewer), manage the team at `/dashboard/team`, invitees accept at `/invite/[token]`, and roles are enforced in the app layer (nav, pages, server actions) with the Phase 1 RLS as backstop.

**Architecture:** New `invitations` table (service-role-only access; all reads/writes go through server actions after app-layer owner checks, mirroring the Phase 1 `merchant_members` write model). A `security definer` SQL function exposes member emails from `auth.users` to the service-role client only. Role resolution lives in `getCurrentRole()` (admin allowlist → owner; else membership role; else legacy `user_id` → owner). Invite emails go out via the Resend REST API with plain `fetch` (no new npm dependency); the invite link is always shown in the team UI so a missing/failing email never blocks onboarding.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS + service-role client), Tailwind 4 CSS-variable theme, Resend REST API.

**Spec:** `docs/superpowers/specs/2026-07-06-customer-dashboard-rehaul-design.md` (§3 Invitations, §4 Roles & permissions). Phase 1 (tenancy) is complete — `merchant_members`, `eh_is_member`/`eh_member_role`, membership-based `getCurrentMerchant()`, workspace switcher are all live.

**Deliberate deviations from the spec (deferred to Phase 3, note in final summary):**
- **Google OAuth** — needs external Google Cloud + Supabase dashboard config; magic link fully covers the invite accept flow. Ships with gated signup.
- **`merchants.status` (live/pending)** — powers gated signup / approval queue, which is Phase 3.
- **"Access approved" email** — belongs to the Phase 3 approval queue.

## Global Constraints

- Work directly on `main`; commit + push after **every** task (`gh auth switch -u CopywriterNull` if push 403s).
- Never `git add -A` / `git add .` — stage specific files.
- Migrations apply to production via the Supabase MCP `apply_migration` (project id `kfzhbkvbxzlsiqcgaoiw`); keep `supabase/migrations/` + `supabase/schema.sql` in sync.
- Roles are exactly `owner | member | viewer` (spec §1). Permission matrix (spec §4): dashboard/report = all roles; install = owner+member; settings = owner; team management = owner (members see read-only list, viewers get no team page).
- `/admin` stays gated by the email allowlist (`src/lib/admin.ts`); admin allowlist emails act as **owner** on any merchant (impersonation parity).
- No test framework in this repo — verification is `npm run build` (type-check) + SQL probes via Supabase MCP. Browser-login checks are **deferred**: append them to `.superpowers/sdd/manual-checklist.md`, do not attempt to log in.
- This is Next.js 16 — read the relevant guide in `node_modules/next/dist/docs/` before writing unfamiliar Next.js code (per AGENTS.md).
- RLS probes via MCP `execute_sql`: never `count(*)` over `escape_events` under an authenticated role (times out); probe `merchants` / `invitations` / `daily_rollups` instead.
- Env vars this phase reads (all optional at runtime, graceful degradation): `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_SITE_URL`.

---

### Task 1: Invitations migration + helper hardening

**Files:**
- Create: `supabase/migrations/20260706190000_invitations_and_role_enforcement.sql`
- Modify: `supabase/schema.sql` (append the same DDL at the end)

**Interfaces:**
- Consumes: Phase 1 objects — `public.merchant_members`, `public.eh_is_member(uuid)`, `public.eh_member_role(uuid)`.
- Produces: `public.invitations` table (columns per code below); `public.eh_team_members(p_merchant_id uuid)` returning `(id uuid, user_id uuid, email text, role text, created_at timestamptz)` — callable **only** by `service_role`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260706190000_invitations_and_role_enforcement.sql`:

```sql
-- Phase 2: invitations + role enforcement support.
-- invitations rows are only ever touched by the service-role client in
-- server actions (after app-layer owner checks) — same write model as
-- merchant_members. RLS is enabled with NO policies so authenticated/anon
-- see nothing; service_role bypasses RLS.

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'member', 'viewer')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists invitations_merchant_idx
  on public.invitations (merchant_id);

alter table public.invitations enable row level security;

-- Team page needs member emails, which live in auth.users. Expose them via
-- a security definer function that only service_role may execute — the app
-- calls it through the admin client after checking the caller is an owner.
create or replace function public.eh_team_members(p_merchant_id uuid)
returns table (
  id uuid,
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select mm.id, mm.user_id, u.email::text, mm.role, mm.created_at
  from public.merchant_members mm
  join auth.users u on u.id = mm.user_id
  where mm.merchant_id = p_merchant_id
  order by mm.created_at asc;
$$;

revoke execute on function public.eh_team_members(uuid) from public, anon, authenticated;
grant execute on function public.eh_team_members(uuid) to service_role;

-- Harden the Phase 1 membership helpers (final-review carry-forward):
-- RLS policies evaluate them as the querying role, so authenticated needs
-- EXECUTE — but anon and the blanket public grant do not.
revoke execute on function public.eh_is_member(uuid) from public, anon;
revoke execute on function public.eh_member_role(uuid) from public, anon;
grant execute on function public.eh_is_member(uuid) to authenticated, service_role;
grant execute on function public.eh_member_role(uuid) to authenticated, service_role;
```

- [ ] **Step 2: Append the same DDL to `supabase/schema.sql`**

Append the full contents of the migration (from `create table if not exists public.invitations` through the final `grant`) to the end of `supabase/schema.sql`, preceded by a comment line `-- ── Phase 2: invitations + role enforcement (20260706190000) ──`.

- [ ] **Step 3: Apply to production via Supabase MCP**

Call `mcp__claude_ai_Supabase__apply_migration` with project id `kfzhbkvbxzlsiqcgaoiw`, name `invitations_and_role_enforcement`, and the migration SQL as the query. (If dispatched as a subagent without MCP access, report BLOCKED so the controller applies it.)

- [ ] **Step 4: Verify in production via MCP `execute_sql`**

```sql
select
  (select relrowsecurity from pg_class where oid = 'public.invitations'::regclass) as invitations_rls,
  (select count(*) from pg_policies where tablename = 'invitations') as invitation_policies,
  has_function_privilege('authenticated', 'public.eh_team_members(uuid)', 'execute') as team_fn_auth,
  has_function_privilege('anon', 'public.eh_is_member(uuid)', 'execute') as is_member_anon,
  has_function_privilege('authenticated', 'public.eh_is_member(uuid)', 'execute') as is_member_auth;
```

Expected: `invitations_rls = true`, `invitation_policies = 0`, `team_fn_auth = false`, `is_member_anon = false`, `is_member_auth = true`.

Then confirm existing RLS still works (regression probe — literal UUID, do NOT touch escape_events):

```sql
begin;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select count(*) as visible_merchants from public.merchants;
select count(*) as visible_invitations from public.invitations;
rollback;
```

Expected: `visible_merchants = 0`, `visible_invitations = 0`.

- [ ] **Step 5: Build + commit + push**

```bash
npm run build   # sanity: no app change yet, must stay green
git add supabase/migrations/20260706190000_invitations_and_role_enforcement.sql supabase/schema.sql
git commit -m "feat: invitations table, team-members fn, membership helper hardening"
git push
```

---

### Task 2: Role plumbing — `roles.ts`, `uuid.ts`, `getCurrentRole()`, settings enforcement

**Files:**
- Create: `src/lib/roles.ts`
- Create: `src/lib/uuid.ts`
- Modify: `src/lib/db.ts` (replace local `MemberRole` with re-export; add `getCurrentRole`)
- Modify: `src/app/actions/merchant.ts` (import `UUID_RE`; role-based owner check in `updateMerchantSettings`)
- Modify: `src/app/actions/admin.ts` (import `UUID_RE`, delete local copy)

**Interfaces:**
- Consumes: `getMemberships()` (cached), `isAdminEmail(email)`, `Merchant` type — all existing.
- Produces (later tasks rely on these exact names):
  - `src/lib/roles.ts`: `export type MemberRole = "owner" | "member" | "viewer"`; `export function roleAtLeast(role: MemberRole | null, min: MemberRole): boolean`.
  - `src/lib/uuid.ts`: `export const UUID_RE: RegExp`.
  - `src/lib/db.ts`: `export async function getCurrentRole(merchant: Merchant): Promise<MemberRole | null>` (also still re-exports `MemberRole`).

- [ ] **Step 1: Create `src/lib/roles.ts`** (client-safe — no `next/headers` import, so client components like SidebarNav can use it)

```ts
export type MemberRole = "owner" | "member" | "viewer";

const ROLE_RANK: Record<MemberRole, number> = { viewer: 0, member: 1, owner: 2 };

/** True when `role` grants at least `min`'s capabilities (owner > member > viewer). */
export function roleAtLeast(role: MemberRole | null, min: MemberRole): boolean {
  return role != null && ROLE_RANK[role] >= ROLE_RANK[min];
}
```

- [ ] **Step 2: Create `src/lib/uuid.ts`** (hoists the regex duplicated in `actions/merchant.ts` and `actions/admin.ts` — Phase 1 review carry-forward)

```ts
// Strict UUID shape guard: every id arriving from a form field must match
// a real PK shape before it is used in a DB filter. Prevents accidental
// "match many rows" writes from empty or partially-typed values.
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

- [ ] **Step 3: Update `src/lib/db.ts`**

Replace the local type definition:

```ts
export type MemberRole = "owner" | "member" | "viewer";
```

with:

```ts
export type { MemberRole } from "@/lib/roles";
```

and add this import at the top alongside the others:

```ts
import type { MemberRole } from "@/lib/roles";
```

Then add `getCurrentRole` directly below `getCurrentMerchant`:

```ts
/** Effective role of the current user on the given merchant.
 *  Admin-allowlist emails act as owner everywhere (impersonation parity).
 *  Legacy merchants.user_id ownership maps to owner so pre-migration
 *  accounts that lack a membership row keep full access.
 *  getMemberships() is request-cached, so calling this after
 *  getCurrentMerchant() costs no extra round trip. */
export async function getCurrentRole(merchant: Merchant): Promise<MemberRole | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (isAdminEmail(user.email)) return "owner";
  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.merchant_id === merchant.id);
  if (membership) return membership.role;
  return merchant.user_id === user.id ? "owner" : null;
}
```

- [ ] **Step 4: Update `src/app/actions/admin.ts`**

Delete the local `UUID_RE` const (and its comment block, lines 11-15) and add:

```ts
import { UUID_RE } from "@/lib/uuid";
```

- [ ] **Step 5: Update `src/app/actions/merchant.ts`**

Delete the local `UUID_RE` const (lines 10-11) and add to the imports:

```ts
import { ACTIVE_MERCHANT_COOKIE, getCurrentMerchant, getCurrentRole } from "@/lib/db";
import { getMemberships } from "@/lib/db";
import { UUID_RE } from "@/lib/uuid";
```

(Combine the db imports into one statement: `import { ACTIVE_MERCHANT_COOKIE, getCurrentMerchant, getCurrentRole, getMemberships } from "@/lib/db";`)

In `updateMerchantSettings`, replace this block:

```ts
  const isAdmin = isAdminEmail(user.email);
  const owns = merchant.user_id === user.id;
  if (!owns && !isAdmin) {
    redirect("/dashboard/settings?saved=0&err=forbidden");
  }
```

with:

```ts
  // Role-based gate (Phase 2): settings writes are owner-only. Admin
  // allowlist emails resolve to owner inside getCurrentRole, so the
  // impersonation path keeps working unchanged.
  const role = await getCurrentRole(merchant);
  if (role !== "owner") {
    redirect("/dashboard/settings?saved=0&err=forbidden");
  }
```

and replace the client-selection block:

```ts
  // Service role only for the admin-impersonating-other-merchant path so
  // RLS doesn't block writes on rows the admin doesn't own. Owners go
  // through their auth context so RLS still governs regular users.
  const client = isAdmin && !owns ? getSupabaseAdmin() : supabase;
```

with:

```ts
  // Owner-by-membership goes through the user's auth context so the
  // "merchants owner update" RLS policy still governs the write. Admins
  // impersonating (no membership row) and legacy user_id-only owners
  // need service role — RLS would reject their session client.
  const memberships = await getMemberships();
  const isOwnerMember = memberships.some(
    (m) => m.merchant_id === merchant.id && m.role === "owner",
  );
  const client = isOwnerMember ? supabase : getSupabaseAdmin();
```

`isAdminEmail` may become unused in this file after the edit — if so, remove it from the imports.

- [ ] **Step 6: Build + commit + push**

```bash
npm run build
```

Expected: compiles with no type errors.

```bash
git add src/lib/roles.ts src/lib/uuid.ts src/lib/db.ts src/app/actions/merchant.ts src/app/actions/admin.ts
git commit -m "feat: role resolution helper + owner-only settings enforcement"
git push
```

---

### Task 3: Email lib + team server actions

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/app/actions/team.ts`

**Interfaces:**
- Consumes: `getCurrentMerchant()`, `getCurrentRole(merchant)`, `getSupabaseServer()`, `getSupabaseAdmin()`, `UUID_RE`, `MemberRole`, `ACTIVE_MERCHANT_COOKIE`, `brand` — all existing/from Task 2. DB objects from Task 1 (`invitations`, `eh_team_members`).
- Produces (Task 4/6 rely on these exact names):
  - `src/lib/email.ts`: `sendInviteEmail(opts: { to: string; merchantName: string; invitedBy: string | null; role: string; acceptUrl: string }): Promise<{ sent: boolean; error: string | null }>`.
  - `src/app/actions/team.ts`: `inviteMember(formData)`, `resendInvitation(formData)`, `revokeInvitation(formData)`, `removeMember(formData)`, `updateMemberRole(formData)`, `acceptInvitation(formData)` — all `(formData: FormData) => Promise<void>` server actions that redirect on completion.

- [ ] **Step 1: Create `src/lib/email.ts`**

```ts
import { brand } from "@/lib/branding";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendResult = { sent: boolean; error: string | null };

function fromAddress(): string {
  return process.env.RESEND_FROM ?? `${brand.name} <invites@${brand.domain}>`;
}

/** Branded team-invite email via the Resend REST API (plain fetch — no SDK
 *  dependency). Best-effort by design: when RESEND_API_KEY is unset or the
 *  request fails we return { sent: false } and the caller surfaces the
 *  copyable accept link instead. Email must never block an invite. */
export async function sendInviteEmail(opts: {
  to: string;
  merchantName: string;
  invitedBy: string | null;
  role: string;
  acceptUrl: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not set" };

  const inviter = opts.invitedBy ?? "A teammate";
  const subject = `You're invited to ${opts.merchantName} on ${brand.name}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
    <div style="font-size:15px;font-weight:600;margin-bottom:24px">${brand.name}</div>
    <h1 style="font-size:20px;margin:0 0 12px">Join ${escapeHtml(opts.merchantName)}</h1>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 20px">
      ${escapeHtml(inviter)} invited you to the <strong>${escapeHtml(opts.merchantName)}</strong>
      workspace on ${brand.name} as a <strong>${escapeHtml(opts.role)}</strong>.
    </p>
    <a href="${opts.acceptUrl}"
       style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
      Accept invitation
    </a>
    <p style="font-size:12px;color:#888;margin:24px 0 0">
      This link expires in 7 days. If the button doesn't work, paste this URL
      into your browser:<br>
      <span style="word-break:break-all">${opts.acceptUrl}</span>
    </p>
  </div>`;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to: [opts.to], subject, html }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      console.error("[sendInviteEmail] resend error", res.status, body);
      return { sent: false, error: `resend ${res.status}` };
    }
    return { sent: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    console.error("[sendInviteEmail] fetch failed", msg);
    return { sent: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
```

- [ ] **Step 2: Create `src/app/actions/team.ts`**

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ACTIVE_MERCHANT_COOKIE,
  getCurrentMerchant,
  getCurrentRole,
  type Merchant,
} from "@/lib/db";
import type { MemberRole } from "@/lib/roles";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/uuid";
import { sendInviteEmail } from "@/lib/email";

const TEAM_PATH = "/dashboard/team";
const ROLES: readonly MemberRole[] = ["owner", "member", "viewer"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function teamRedirect(msg: string, extra: Record<string, string> = {}): never {
  const params = new URLSearchParams({ msg, ...extra });
  redirect(`${TEAM_PATH}?${params.toString()}`);
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://getescapehatch.com";
}

type SupabaseAdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Owner gate shared by every team mutation. Resolves the current merchant
 *  and requires role owner (admin allowlist counts as owner). All writes
 *  below use the service-role client and MUST scope every filter by
 *  merchant.id so an owner of workspace A can never touch workspace B. */
async function requireOwner(): Promise<{
  merchant: Merchant;
  admin: SupabaseAdminClient;
  userId: string;
  userEmail: string | null;
}> {
  const merchant = await getCurrentMerchant();
  if (!merchant) redirect("/dashboard");
  const role = await getCurrentRole(merchant);
  if (role !== "owner") teamRedirect("forbidden");
  const admin = getSupabaseAdmin();
  const supabase = await getSupabaseServer();
  if (!admin || !supabase) teamRedirect("no_backend");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { merchant, admin, userId: user.id, userEmail: user.email ?? null };
}

export async function inviteMember(formData: FormData) {
  const { merchant, admin, userId, userEmail } = await requireOwner();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!EMAIL_RE.test(email)) teamRedirect("bad_email");
  if (!ROLES.includes(role as MemberRole)) teamRedirect("bad_role");

  // Already a member → no-op with message (spec §3 edge case).
  const { data: members } = await admin.rpc("eh_team_members", {
    p_merchant_id: merchant.id,
  });
  const memberRows = (members ?? []) as { email: string | null }[];
  if (memberRows.some((m) => (m.email ?? "").toLowerCase() === email)) {
    teamRedirect("already_member", { email });
  }

  // Existing pending invite for this address → refresh it instead of
  // inserting a duplicate row (keeps one live token per email).
  const { data: existing } = await admin
    .from("invitations")
    .select("id, token")
    .eq("merchant_id", merchant.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  let token: string;
  if (existing) {
    token = existing.token as string;
    const { error } = await admin
      .from("invitations")
      .update({
        role,
        invited_by: userId,
        expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      })
      .eq("id", existing.id)
      .eq("merchant_id", merchant.id);
    if (error) teamRedirect("invite_failed");
  } else {
    const { data, error } = await admin
      .from("invitations")
      .insert({ merchant_id: merchant.id, email, role, invited_by: userId })
      .select("token")
      .single();
    if (error || !data) teamRedirect("invite_failed");
    token = data.token as string;
  }

  const acceptUrl = `${siteOrigin()}/invite/${token}`;
  const result = await sendInviteEmail({
    to: email,
    merchantName: merchant.name ?? merchant.domain ?? "your workspace",
    invitedBy: userEmail,
    role,
    acceptUrl,
  });

  revalidatePath(TEAM_PATH);
  teamRedirect(result.sent ? "invite_sent" : "invite_created_no_email", { email });
}

export async function resendInvitation(formData: FormData) {
  const { merchant, admin, userEmail } = await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) teamRedirect("not_found");

  const { data: invite } = await admin
    .from("invitations")
    .select("id, email, role, token, status")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!invite || invite.status !== "pending") teamRedirect("not_found");

  const { error } = await admin
    .from("invitations")
    .update({ expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() })
    .eq("id", invite.id)
    .eq("merchant_id", merchant.id);
  if (error) teamRedirect("invite_failed");

  const acceptUrl = `${siteOrigin()}/invite/${invite.token}`;
  const result = await sendInviteEmail({
    to: invite.email as string,
    merchantName: merchant.name ?? merchant.domain ?? "your workspace",
    invitedBy: userEmail,
    role: invite.role as string,
    acceptUrl,
  });

  revalidatePath(TEAM_PATH);
  teamRedirect(result.sent ? "invite_sent" : "invite_created_no_email", {
    email: invite.email as string,
  });
}

export async function revokeInvitation(formData: FormData) {
  const { merchant, admin } = await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) teamRedirect("not_found");

  await admin
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .eq("status", "pending");

  revalidatePath(TEAM_PATH);
  teamRedirect("invite_revoked");
}

/** Shared guard: block removing/demoting the only owner (spec §3). */
async function assertNotLastOwner(
  admin: SupabaseAdminClient,
  merchantId: string,
): Promise<void> {
  const { count } = await admin
    .from("merchant_members")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("role", "owner");
  if ((count ?? 0) <= 1) teamRedirect("last_owner");
}

export async function removeMember(formData: FormData) {
  const { merchant, admin } = await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) teamRedirect("not_found");

  const { data: target } = await admin
    .from("merchant_members")
    .select("id, role")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!target) teamRedirect("not_found");
  if (target.role === "owner") await assertNotLastOwner(admin, merchant.id);

  await admin
    .from("merchant_members")
    .delete()
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  revalidatePath(TEAM_PATH);
  revalidatePath("/dashboard", "layout");
  teamRedirect("member_removed");
}

export async function updateMemberRole(formData: FormData) {
  const { merchant, admin } = await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  if (!UUID_RE.test(id)) teamRedirect("not_found");
  if (!ROLES.includes(role as MemberRole)) teamRedirect("bad_role");

  const { data: target } = await admin
    .from("merchant_members")
    .select("id, role")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!target) teamRedirect("not_found");
  if (target.role === role) teamRedirect("role_unchanged");
  if (target.role === "owner" && role !== "owner") {
    await assertNotLastOwner(admin, merchant.id);
  }

  await admin
    .from("merchant_members")
    .update({ role })
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  revalidatePath(TEAM_PATH);
  revalidatePath("/dashboard", "layout");
  teamRedirect("role_updated");
}

/** Invite accept — the only membership-creation path for non-admin users.
 *  Called from /invite/[token] after the page has already rendered the
 *  precise error state for bad tokens; failures here just bounce back to
 *  the page, which re-renders the current truth. */
export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!UUID_RE.test(token)) redirect("/login");

  const supabase = await getSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/invite/${token}`);

  const admin = getSupabaseAdmin();
  if (!admin) redirect(`/invite/${token}`);

  const { data: invite } = await admin
    .from("invitations")
    .select("id, merchant_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (
    !invite ||
    invite.status !== "pending" ||
    new Date(invite.expires_at as string) < new Date() ||
    (user.email ?? "").toLowerCase() !== (invite.email as string).toLowerCase()
  ) {
    redirect(`/invite/${token}`);
  }

  const { error: memberError } = await admin.from("merchant_members").upsert(
    { merchant_id: invite.merchant_id, user_id: user.id, role: invite.role },
    { onConflict: "merchant_id,user_id", ignoreDuplicates: true },
  );
  if (memberError) redirect(`/invite/${token}`);

  await admin
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .eq("status", "pending");

  // Land the new member directly in the workspace they just joined.
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_MERCHANT_COOKIE, invite.merchant_id as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
```

Note: `getSupabaseAdmin()` returns an untyped client (`any` via `require`); if `NonNullable<ReturnType<typeof getSupabaseAdmin>>` resolves to `any`, that is acceptable here — match how `admin.ts` uses it. If the `SupabaseAdminClient` alias fights the type-checker, inline the calls the way `actions/admin.ts` does and drop the alias.

- [ ] **Step 3: Build + commit + push**

```bash
npm run build
```

Expected: compiles clean (actions are not yet imported anywhere — that's fine, they must still type-check).

```bash
git add src/lib/email.ts src/app/actions/team.ts
git commit -m "feat: resend invite email lib + team server actions"
git push
```

---

### Task 4: `/dashboard/team` page

**Files:**
- Create: `src/app/dashboard/team/page.tsx`
- Create: `src/app/dashboard/team/_components/copy-link-button.tsx`

**Interfaces:**
- Consumes: `getCurrentMerchant`, `getCurrentRole`, `getSupabaseAdmin`, `eh_team_members` RPC, `invitations` table, actions from Task 3 (`inviteMember`, `resendInvitation`, `revokeInvitation`, `removeMember`, `updateMemberRole`), `MemberRole`.
- Produces: the page later linked from nav (Task 5). No exports consumed elsewhere.

- [ ] **Step 1: Create `src/app/dashboard/team/_components/copy-link-button.tsx`**

```tsx
"use client";

import { useState } from "react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard can be unavailable (permissions/http); fall back to prompt-free noop.
        }
      }}
      className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] border border-[var(--color-border-soft)] transition-colors"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/team/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getCurrentMerchant, getCurrentRole } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  inviteMember,
  resendInvitation,
  revokeInvitation,
  removeMember,
  updateMemberRole,
} from "@/app/actions/team";
import { CopyLinkButton } from "./_components/copy-link-button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ msg?: string; email?: string }>;

type MemberRow = {
  id: string;
  user_id: string;
  email: string | null;
  role: "owner" | "member" | "viewer";
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
};

const MESSAGES: Record<string, { text: string; error: boolean }> = {
  invite_sent: { text: "Invitation email sent.", error: false },
  invite_created_no_email: {
    text: "Invite created — email delivery isn't configured, share the link below.",
    error: false,
  },
  invite_revoked: { text: "Invitation revoked.", error: false },
  member_removed: { text: "Member removed.", error: false },
  role_updated: { text: "Role updated.", error: false },
  role_unchanged: { text: "That member already has that role.", error: false },
  already_member: { text: "That email is already a member.", error: true },
  bad_email: { text: "Enter a valid email address.", error: true },
  bad_role: { text: "Pick a valid role.", error: true },
  last_owner: {
    text: "Every workspace needs at least one owner — promote someone else first.",
    error: true,
  },
  not_found: { text: "That invitation or member no longer exists.", error: true },
  invite_failed: { text: "Couldn't save the invitation — try again.", error: true },
  forbidden: { text: "Only owners can manage the team.", error: true },
  no_backend: { text: "Backend not configured.", error: true },
};

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://getescapehatch.com";
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [merchant, sp] = await Promise.all([getCurrentMerchant(), searchParams]);
  if (!merchant) redirect("/dashboard");
  const role = await getCurrentRole(merchant);
  // Spec §3: viewers have no team page; members get the read-only list.
  if (!role || role === "viewer") redirect("/dashboard");
  const isOwner = role === "owner";

  const admin = getSupabaseAdmin();
  const [membersRes, invitesRes] = admin
    ? await Promise.all([
        admin.rpc("eh_team_members", { p_merchant_id: merchant.id }),
        admin
          .from("invitations")
          .select("id, email, role, token, expires_at, created_at")
          .eq("merchant_id", merchant.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ])
    : [{ data: null }, { data: null }];

  const members = ((membersRes.data ?? []) as MemberRow[]);
  const invites = ((invitesRes.data ?? []) as InviteRow[]);
  const now = Date.now();

  const banner = sp.msg ? MESSAGES[sp.msg] : undefined;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          Workspace
        </div>
        <h1 className="mt-1.5 h-display text-4xl">Team</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-dim)] max-w-prose">
          {isOwner
            ? "Invite teammates and manage their access to this workspace."
            : "People with access to this workspace. Ask an owner to make changes."}
        </p>
      </div>

      {banner ? (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            banner.error
              ? "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
              : "border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] text-[var(--color-fg)]"
          }`}
        >
          {banner.text}
          {sp.email ? <span className="font-mono text-[12px]"> ({sp.email})</span> : null}
        </div>
      ) : null}

      {isOwner ? (
        <section className="card-hi p-5">
          <h2 className="text-sm font-semibold tracking-tight">Invite a teammate</h2>
          <p className="mt-1 text-[12.5px] text-[var(--color-fg-dim)]">
            They'll get an email with a link that expires in 7 days. Viewers can
            see reports only; members can also use the install page; owners can
            change settings and manage the team.
          </p>
          <form action={inviteMember} className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <input
              type="email"
              name="email"
              required
              placeholder="teammate@brand.com"
              className="flex-1 px-3.5 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-fg-muted)] focus-ring"
            />
            <select
              name="role"
              defaultValue="member"
              className="px-3 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus-ring"
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
            >
              Send invite
            </button>
          </form>
        </section>
      ) : null}

      <section className="card-hi p-5">
        <h2 className="text-sm font-semibold tracking-tight">
          Members <span className="text-[var(--color-fg-muted)] font-normal">({members.length})</span>
        </h2>
        <div className="mt-3 divide-y divide-[var(--color-border-soft)]">
          {members.map((m) => (
            <div key={m.id} className="py-3 flex flex-wrap items-center gap-3">
              <span className="size-7 rounded-full bg-[var(--color-accent)]/15 grid place-items-center text-[11px] font-semibold text-[var(--color-accent)] shrink-0">
                {m.email?.[0]?.toUpperCase() ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] truncate">{m.email ?? m.user_id}</div>
                <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                  joined {new Date(m.created_at).toISOString().slice(0, 10)}
                </div>
              </div>
              {isOwner ? (
                <div className="flex items-center gap-2">
                  <form action={updateMemberRole} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={m.id} />
                    <select
                      name="role"
                      defaultValue={m.role}
                      className="px-2 py-1 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] text-[12px] focus-ring"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      type="submit"
                      className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] border border-[var(--color-border-soft)] transition-colors"
                    >
                      Update
                    </button>
                  </form>
                  <form action={removeMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] border border-[var(--color-border-soft)] transition-colors"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wide bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] text-[var(--color-fg-dim)]">
                  {m.role}
                </span>
              )}
            </div>
          ))}
          {members.length === 0 ? (
            <div className="py-4 text-sm text-[var(--color-fg-dim)]">No members found.</div>
          ) : null}
        </div>
      </section>

      {isOwner ? (
        <section className="card-hi p-5">
          <h2 className="text-sm font-semibold tracking-tight">
            Pending invitations{" "}
            <span className="text-[var(--color-fg-muted)] font-normal">({invites.length})</span>
          </h2>
          <div className="mt-3 divide-y divide-[var(--color-border-soft)]">
            {invites.map((inv) => {
              const expired = new Date(inv.expires_at).getTime() < now;
              return (
                <div key={inv.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] truncate">{inv.email}</div>
                    <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                      {inv.role} ·{" "}
                      {expired ? (
                        <span className="text-[var(--color-danger)]">expired</span>
                      ) : (
                        `expires ${new Date(inv.expires_at).toISOString().slice(0, 10)}`
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyLinkButton url={`${siteOrigin()}/invite/${inv.token}`} />
                    <form action={resendInvitation}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] border border-[var(--color-border-soft)] transition-colors"
                      >
                        Resend
                      </button>
                    </form>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] border border-[var(--color-border-soft)] transition-colors"
                      >
                        Revoke
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
            {invites.length === 0 ? (
              <div className="py-4 text-sm text-[var(--color-fg-dim)]">
                No pending invitations.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Build + commit + push**

```bash
npm run build
```

Expected: compiles clean; `/dashboard/team` appears in the route list.

```bash
git add src/app/dashboard/team/page.tsx src/app/dashboard/team/_components/copy-link-button.tsx
git commit -m "feat: /dashboard/team page — member list, invite form, pending invites"
git push
```

---

### Task 5: Role gating — nav, settings, install

**Files:**
- Modify: `src/app/dashboard/_components/sidebar-nav.tsx` (role prop + Team link)
- Modify: `src/app/dashboard/layout.tsx` (resolve role, pass to nav, filter mobile links)
- Modify: `src/app/dashboard/settings/page.tsx` (owner-only redirect)
- Modify: `src/app/dashboard/install/page.tsx` (viewer redirect)

**Interfaces:**
- Consumes: `getCurrentRole(merchant)` (Task 2), `roleAtLeast(role, min)` + `MemberRole` from `@/lib/roles` (client-safe), `/dashboard/team` route (Task 4).
- Produces: `SidebarNav` signature becomes `SidebarNav({ role }: { role: MemberRole | null })` — the layout is its only caller.

- [ ] **Step 1: Rewrite `src/app/dashboard/_components/sidebar-nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelIcon } from "@/components/PixelIcon";
import { roleAtLeast, type MemberRole } from "@/lib/roles";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "home" as const, minRole: "viewer" as const },
  { href: "/dashboard/report", label: "Report", icon: "chart" as const, minRole: "viewer" as const },
  { href: "/dashboard/install", label: "Install", icon: "terminal" as const, minRole: "member" as const },
  { href: "/dashboard/team", label: "Team", icon: "user" as const, minRole: "member" as const },
  { href: "/dashboard/settings", label: "Settings", icon: "gear" as const, minRole: "owner" as const },
];

export function SidebarNav({ role }: { role: MemberRole | null }) {
  const pathname = usePathname();
  return (
    <nav className="px-2 flex flex-col gap-0.5">
      {NAV.filter((item) => roleAtLeast(role, item.minRole)).map((item) => {
        const active =
          item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] tracking-tight transition-colors ${
              active
                ? "bg-[var(--color-card)] text-[var(--color-fg)] font-medium"
                : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)]/60"
            }`}
            style={
              active ? { boxShadow: "0 0 0 1px var(--color-border-soft) inset" } : undefined
            }
            aria-current={active ? "page" : undefined}
          >
            <PixelIcon
              name={item.icon}
              size={14}
              className={active ? "text-[var(--color-accent)]" : "text-[var(--color-fg-muted)]"}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

(The `"user"` icon already exists in `src/components/PixelIcon.tsx`.)

- [ ] **Step 2: Update `src/app/dashboard/layout.tsx`**

Add imports:

```ts
import { getCurrentMerchant, getCurrentRole, getImpersonationStatus, getMemberships } from "@/lib/db";
import { roleAtLeast } from "@/lib/roles";
```

After the `if (!merchant) { ... }` early-return block (i.e. once `merchant` is non-null), add:

```ts
  // Role drives which nav items render. getMemberships() is request-cached,
  // so this adds no extra round trip after the Promise.all above. Null role
  // is treated as viewer: show the read-only nav rather than nothing.
  const role = (await getCurrentRole(merchant)) ?? "viewer";
```

Change the sidebar nav call from `<SidebarNav />` to:

```tsx
        <SidebarNav role={role} />
```

Replace the hardcoded mobile nav block:

```tsx
            <nav className="flex items-center gap-1">
              <Link href="/dashboard" className="px-2 py-1 text-[var(--color-fg)] font-medium">Overview</Link>
              <Link href="/dashboard/report" className="px-2 py-1 text-[var(--color-fg-muted)]">Report</Link>
              <Link href="/dashboard/install" className="px-2 py-1 text-[var(--color-fg-muted)]">Install</Link>
              <Link href="/dashboard/settings" className="px-2 py-1 text-[var(--color-fg-muted)]">Settings</Link>
            </nav>
```

with:

```tsx
            <nav className="flex items-center gap-1">
              <Link href="/dashboard" className="px-2 py-1 text-[var(--color-fg)] font-medium">Overview</Link>
              <Link href="/dashboard/report" className="px-2 py-1 text-[var(--color-fg-muted)]">Report</Link>
              {roleAtLeast(role, "member") ? (
                <Link href="/dashboard/install" className="px-2 py-1 text-[var(--color-fg-muted)]">Install</Link>
              ) : null}
              {roleAtLeast(role, "member") ? (
                <Link href="/dashboard/team" className="px-2 py-1 text-[var(--color-fg-muted)]">Team</Link>
              ) : null}
              {roleAtLeast(role, "owner") ? (
                <Link href="/dashboard/settings" className="px-2 py-1 text-[var(--color-fg-muted)]">Settings</Link>
              ) : null}
            </nav>
```

- [ ] **Step 3: Gate `src/app/dashboard/settings/page.tsx` (owner-only, spec §4)**

Add `import { redirect } from "next/navigation";` and extend the existing db import to:

```ts
import { getCurrentMerchant, getCurrentRole, getImpersonationStatus } from "@/lib/db";
```

Immediately after the existing `if (!merchant) { ... }` block, add:

```ts
  // Spec §4: settings edits are owner-only. Members/viewers who deep-link
  // here land back on the overview. Admin allowlist resolves to owner.
  const role = await getCurrentRole(merchant);
  if (role !== "owner") redirect("/dashboard");
```

- [ ] **Step 4: Gate `src/app/dashboard/install/page.tsx` (viewer blocked, spec §4)**

Add `import { redirect } from "next/navigation";` and extend the existing db import to:

```ts
import { getCurrentMerchant, getCurrentRole, getImpersonationStatus } from "@/lib/db";
```

Immediately after the existing `if (!merchant) { ... }` block, add:

```ts
  // Spec §4: install page is owner+member; viewers land back on overview.
  const role = await getCurrentRole(merchant);
  if (!roleAtLeast(role, "member")) redirect("/dashboard");
```

with `import { roleAtLeast } from "@/lib/roles";` added to the imports.

- [ ] **Step 5: Build + commit + push**

```bash
npm run build
```

Expected: compiles clean.

```bash
git add src/app/dashboard/_components/sidebar-nav.tsx src/app/dashboard/layout.tsx src/app/dashboard/settings/page.tsx src/app/dashboard/install/page.tsx
git commit -m "feat: role-gated nav, settings (owner) and install (member+) pages"
git push
```

---

### Task 6: Invite accept flow — `/invite/[token]`, login prefill, callback hardening

**Files:**
- Create: `src/app/invite/[token]/page.tsx`
- Modify: `src/app/login/login-form.tsx` (add `initialEmail` / `next` props)
- Modify: `src/app/auth/callback/route.ts` (reject absolute-URL `next` values)

**Interfaces:**
- Consumes: `acceptInvitation` (Task 3), `UUID_RE`, `getSupabaseServer`, `getSupabaseAdmin`, `signOut` from `@/app/actions/auth`, `brand`, `LoginForm`.
- Produces: `LoginForm({ initialEmail?: string; next?: string })` — the no-prop call in `src/app/login/page.tsx` keeps working because both props are optional.

- [ ] **Step 1: Harden `src/app/auth/callback/route.ts`**

Replace:

```ts
  const next = url.searchParams.get("next") ?? "/dashboard";
```

with:

```ts
  // Only same-origin relative paths — an absolute URL (or protocol-relative
  // "//host") in `next` would make the auth callback an open redirect.
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
```

- [ ] **Step 2: Add prefill/next props to `src/app/login/login-form.tsx`**

Change the component signature and initial state:

```tsx
export function LoginForm({
  initialEmail = "",
  next,
}: {
  initialEmail?: string;
  next?: string;
} = {}) {
  const [email, setEmail] = useState(initialEmail);
```

and change the `signInWithOtp` options to thread `next` through the callback:

```ts
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${
          next ? `?next=${encodeURIComponent(next)}` : ""
        }`,
      },
    });
```

Everything else in the file stays byte-identical.

- [ ] **Step 3: Create `src/app/invite/[token]/page.tsx`**

```tsx
import Link from "next/link";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/uuid";
import { brand } from "@/lib/branding";
import { signOut } from "@/app/actions/auth";
import { acceptInvitation } from "@/app/actions/team";
import { LoginForm } from "@/app/login/login-form";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center px-5 mesh-bg grain relative">
      <div className="absolute inset-0 dotgrid opacity-30 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      <div className="relative w-full max-w-sm card-hi p-8">{children}</div>
    </div>
  );
}

function ErrorCard({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <h1 className="h-display text-2xl">{title}</h1>
      <p className="mt-2 text-sm text-[var(--color-fg-dim)]">{body}</p>
      <Link
        href="/login"
        className="mt-5 inline-flex text-sm text-[var(--color-accent)] link-grow"
      >
        Go to sign in →
      </Link>
    </Shell>
  );
}

type InviteWithMerchant = {
  id: string;
  merchant_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  merchants: { name: string | null; domain: string | null } | null;
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) {
    return (
      <ErrorCard
        title="Invalid invitation"
        body="This invite link is malformed. Ask your workspace admin to send a new one."
      />
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return (
      <ErrorCard
        title="Backend not configured"
        body="Invitations aren't available in this environment."
      />
    );
  }

  const { data } = await admin
    .from("invitations")
    .select("id, merchant_id, email, role, status, expires_at, merchants ( name, domain )")
    .eq("token", token)
    .maybeSingle();
  const invite = data as InviteWithMerchant | null;

  if (!invite) {
    return (
      <ErrorCard
        title="Invitation not found"
        body="This invite link doesn't exist. Ask your workspace admin to re-invite you."
      />
    );
  }
  if (invite.status === "revoked") {
    return (
      <ErrorCard
        title="Invitation revoked"
        body="This invitation was revoked. Ask your workspace admin to re-invite you."
      />
    );
  }
  if (invite.status === "accepted") {
    return (
      <ErrorCard
        title="Invitation already used"
        body="This invitation has already been accepted. If that was you, just sign in."
      />
    );
  }
  if (invite.status === "expired" || new Date(invite.expires_at) < new Date()) {
    return (
      <ErrorCard
        title="Invitation expired"
        body="Invite links last 7 days. Ask your workspace admin to re-send it."
      />
    );
  }

  const workspaceName = invite.merchants?.name ?? invite.merchants?.domain ?? "a workspace";

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  if (!user) {
    return (
      <Shell>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          You're invited
        </div>
        <h1 className="mt-1 h-display text-2xl">
          Join {workspaceName} on {brand.name}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--color-fg-dim)]">
          Sign in as <strong className="text-[var(--color-fg)]">{invite.email}</strong> to
          accept this invitation. We'll email you a magic link.
        </p>
        <LoginForm initialEmail={invite.email} next={`/invite/${token}`} />
      </Shell>
    );
  }

  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell>
        <h1 className="h-display text-2xl">Wrong account</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
          This invitation is for{" "}
          <strong className="text-[var(--color-fg)]">{invite.email}</strong>, but you're
          signed in as <strong className="text-[var(--color-fg)]">{user.email}</strong>.
          Sign out, then open the invite link again.
        </p>
        <form action={signOut} className="mt-5">
          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          >
            Sign out
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
        You're invited
      </div>
      <h1 className="mt-1 h-display text-2xl">Join {workspaceName}</h1>
      <p className="mt-1.5 text-sm text-[var(--color-fg-dim)]">
        You'll join as a{" "}
        <strong className="text-[var(--color-fg)]">{invite.role}</strong> with the account{" "}
        <strong className="text-[var(--color-fg)]">{user.email}</strong>.
      </p>
      <form action={acceptInvitation} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          Accept invitation
        </button>
      </form>
    </Shell>
  );
}
```

(Cookie writes are not allowed during server-component render, which is why acceptance is a button-press server action rather than auto-accept on page load.)

- [ ] **Step 4: Build + commit + push**

```bash
npm run build
```

Expected: compiles clean; `/invite/[token]` appears in the route list.

```bash
git add src/app/invite/[token]/page.tsx src/app/login/login-form.tsx src/app/auth/callback/route.ts
git commit -m "feat: /invite/[token] accept flow, login prefill, callback open-redirect fix"
git push
```

---

### Task 7: Phase verification + manual checklist

**Files:**
- Modify: `.superpowers/sdd/manual-checklist.md` (append Phase 2 section)
- Modify: `.superpowers/sdd/progress.md` (mark phase complete — ledger only, not committed if git-ignored)

**Interfaces:**
- Consumes: everything above, live in prod.
- Produces: verification evidence + the human checklist.

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: clean compile, routes include `/dashboard/team` and `/invite/[token]`.

- [ ] **Step 2: Prod SQL verification via Supabase MCP `execute_sql`** (project `kfzhbkvbxzlsiqcgaoiw`)

Invitations invisible to authenticated users (RLS, no policies):

```sql
begin;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select count(*) as visible_invitations from public.invitations;
rollback;
```

Expected: `visible_invitations = 0` regardless of table contents.

Function ACLs (regression from Task 1):

```sql
select
  has_function_privilege('anon', 'public.eh_is_member(uuid)', 'execute') as anon_is_member,
  has_function_privilege('authenticated', 'public.eh_member_role(uuid)', 'execute') as auth_member_role,
  has_function_privilege('authenticated', 'public.eh_team_members(uuid)', 'execute') as auth_team_members;
```

Expected: `false, true, false`.

G FUEL regression (existing owner unaffected — probe merchants + rollups only):

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from public.merchants where name ilike '%fuel%' limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*) as gfuel_merchants from public.merchants;
select count(*) as gfuel_daily from public.daily_rollups;
rollback;
```

Expected: `gfuel_merchants ≥ 1`, `gfuel_daily > 0` (same counts as the Phase 1 probe: 1 merchant for the G FUEL owner).

- [ ] **Step 3: Append Phase 2 section to `.superpowers/sdd/manual-checklist.md`**

```markdown
# Phase 2 — Manual Browser Smoke Checklist

Prereqs (one-time, external):
- [ ] Resend: create API key, verify the getescapehatch.com sending domain,
      set `RESEND_API_KEY` (and optionally `RESEND_FROM`) in Vercel, redeploy.
      Until then, invites still work — use the "Copy link" button on
      /dashboard/team and send the link yourself.
- [ ] Supabase Auth → URL Configuration: confirm the redirect allow-list
      matches `/auth/callback` with query strings (invite login uses
      `/auth/callback?next=/invite/<token>`).

## 1. Owner invites a viewer (full loop)
- [ ] As the G FUEL owner (or impersonating admin), open /dashboard/team,
      invite a test email as Viewer. Banner confirms sent (or copy the link).
- [ ] Open the invite link in a private window → "Join …" login card with the
      email prefilled → magic link → land back on the invite → Accept → land
      on the G FUEL dashboard.
- [ ] The viewer sees Overview + Report only (no Install/Team/Settings in
      nav); deep-linking /dashboard/settings and /dashboard/install redirects
      to /dashboard.

## 2. Member role
- [ ] Change the test user's role to Member on /dashboard/team → they now see
      Install + Team (read-only list, no invite form), still no Settings.

## 3. Edge cases
- [ ] Revoke a pending invite → its link shows "Invitation revoked".
- [ ] Open an accepted invite link again → "Invitation already used".
- [ ] Open an invite while signed in as a different email → "Wrong account"
      card with working sign-out.
- [ ] Try to demote/remove the only owner → blocked with the
      "at least one owner" message.

## 4. Regressions
- [ ] Existing owner dashboard + settings save still work (settings now
      requires owner role — verify a normal owner can still save).
- [ ] Admin impersonation unchanged; admin sees full nav incl. Team.

## Cleanup after testing
```sql
delete from public.merchant_members
 where user_id = (select id from auth.users where email = '<your-test-email>');
delete from public.invitations where email = '<your-test-email>';
```
```

- [ ] **Step 4: Commit + push the checklist**

```bash
git add .superpowers/sdd/manual-checklist.md docs/superpowers/plans/2026-07-06-phase2-invites-team-roles.md
git commit -m "docs: phase 2 plan + manual smoke checklist"
git push
```

(If `.superpowers/` is git-ignored, commit only the plan file and leave the checklist as a local artifact — check `git check-ignore .superpowers/sdd/manual-checklist.md` first.)

- [ ] **Step 5: Update the progress ledger** (`.superpowers/sdd/progress.md`) with the phase outcome, deferred items (Google OAuth, merchants.status, approval email → Phase 3), and any reviewer carry-forwards.
