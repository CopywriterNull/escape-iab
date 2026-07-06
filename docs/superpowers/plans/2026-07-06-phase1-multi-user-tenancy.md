# Phase 1: Multi-User Tenancy Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1:1 `merchants.user_id` access model with a `merchant_members` membership table (backfilled from existing owners) so multiple users can access one merchant — with zero visible change for existing users.

**Architecture:** A new `merchant_members` table becomes the source of truth for access; RLS policies on all five customer-readable tables switch from `user_id`-ownership checks to membership checks via a `security definer` helper. `getCurrentMerchant()` resolves via membership + an active-merchant cookie; the auth callback stops auto-creating merchants; the MerchantSwitcher gains a non-admin "switch" mode.

**Tech Stack:** Next.js 16 App Router (see AGENTS.md warning — read `node_modules/next/dist/docs/` before writing unfamiliar Next.js code), Supabase (`@supabase/ssr`), Tailwind 4. Spec: `docs/superpowers/specs/2026-07-06-customer-dashboard-rehaul-design.md`.

## Global Constraints

- Roles are exactly `owner` | `member` | `viewer`. Role *enforcement* (viewer can't see settings, etc.) is **Phase 2** — Phase 1 only stores roles.
- `merchants.user_id` is retained as legacy; do NOT drop it. Legacy `owns` checks in server actions keep working because backfill guarantees every legacy owner also has a membership row.
- Admin impersonation (`eh_imp_merchant_id` cookie, hardcoded `ADMIN_EMAILS`) must be unchanged.
- Success criterion: **existing dashboards behave identically after this phase** (verify against G FUEL live data).
- No test framework exists in this repo — verification is `npm run build`, SQL checks, and manual login checks (repo convention).
- Migrations: create the file under `supabase/migrations/` AND apply it to the production Supabase project via the Supabase MCP `apply_migration` tool (project: EscapeHatch — id in `SUPABASE.md`). Never `git add -A`; stage specific files. Push after every commit.
- Active-merchant cookie name: `eh_active_merchant_id`.

---

### Task 1: Migration — `merchant_members`, backfill, membership RLS

**Files:**
- Create: `supabase/migrations/20260706150000_multi_user_tenancy.sql`
- Modify: `supabase/schema.sql` (append the same table + policies so the canonical schema doc stays truthful)

**Interfaces:**
- Produces: table `public.merchant_members(id, merchant_id, user_id, role, created_at)`; SQL helpers `public.eh_is_member(uuid) → boolean` and `public.eh_member_role(uuid) → text` used by all later policies and (in later phases) by app queries.

- [ ] **Step 1: Write the migration file**

`supabase/migrations/20260706150000_multi_user_tenancy.sql`:

```sql
-- Multi-user tenancy foundation (Phase 1 of customer dashboard rehaul).
-- merchant_members becomes the source of truth for who can access a merchant.
-- merchants.user_id is retained as legacy and dropped in a later cleanup.

create table if not exists public.merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);

create index if not exists merchant_members_user_idx
  on public.merchant_members (user_id);

alter table public.merchant_members enable row level security;

-- Users may read their own membership rows (dashboard resolution + switcher).
-- All WRITES to merchant_members go through the service-role client in server
-- actions (Phase 2 invites); regular users get no insert/update/delete policy.
drop policy if exists "members self read" on public.merchant_members;
create policy "members self read" on public.merchant_members
  for select using (auth.uid() = user_id);

-- Backfill: every legacy 1:1 owner becomes an explicit owner membership.
insert into public.merchant_members (merchant_id, user_id, role)
select m.id, m.user_id, 'owner'
from public.merchants m
where m.user_id is not null
on conflict (merchant_id, user_id) do nothing;

-- security definer helpers: policies on OTHER tables call these to check
-- membership without being subject to merchant_members' own RLS, and to
-- keep the policy bodies short and index-friendly.
create or replace function public.eh_is_member(p_merchant_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.merchant_members mm
    where mm.merchant_id = p_merchant_id and mm.user_id = auth.uid()
  );
$$;

create or replace function public.eh_member_role(p_merchant_id uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select mm.role from public.merchant_members mm
  where mm.merchant_id = p_merchant_id and mm.user_id = auth.uid()
  limit 1;
$$;

-- ── Switch read policies from user_id-ownership to membership ──────────────
-- Backfill above runs in this same transaction, so membership-only checks
-- cannot lock out an existing owner.

drop policy if exists "merchants self read" on public.merchants;
drop policy if exists "merchants member read" on public.merchants;
create policy "merchants member read" on public.merchants
  for select using (public.eh_is_member(id));

-- Auto-create-on-first-login is removed in this phase; users no longer
-- insert merchants rows themselves (admin/service-role bypasses RLS).
drop policy if exists "merchants self insert" on public.merchants;

drop policy if exists "merchants self update" on public.merchants;
drop policy if exists "merchants owner update" on public.merchants;
create policy "merchants owner update" on public.merchants
  for update using (public.eh_member_role(id) = 'owner');

drop policy if exists "events self read" on public.escape_events;
drop policy if exists "events member read" on public.escape_events;
create policy "events member read" on public.escape_events
  for select using (public.eh_is_member(merchant_id));

drop policy if exists "rollups self read" on public.daily_rollups;
drop policy if exists "rollups member read" on public.daily_rollups;
create policy "rollups member read" on public.daily_rollups
  for select using (public.eh_is_member(merchant_id));

drop policy if exists "hourly rollups self read" on public.hourly_funnel_rollups;
drop policy if exists "hourly rollups member read" on public.hourly_funnel_rollups;
create policy "hourly rollups member read" on public.hourly_funnel_rollups
  for select using (public.eh_is_member(merchant_id));

drop policy if exists "cart attributions self read" on public.cart_attributions;
drop policy if exists "cart attributions member read" on public.cart_attributions;
create policy "cart attributions member read" on public.cart_attributions
  for select using (public.eh_is_member(merchant_id));
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP: `apply_migration` with name `multi_user_tenancy` and the file's SQL. Expected: success, no errors.

- [ ] **Step 3: Verify backfill and policies with SQL**

Run via Supabase MCP `execute_sql`:

```sql
select
  (select count(*) from public.merchants where user_id is not null) as legacy_owners,
  (select count(*) from public.merchant_members where role = 'owner') as owner_members;
```

Expected: `legacy_owners = owner_members` (every legacy owner backfilled).

```sql
select tablename, policyname from pg_policies
where schemaname = 'public'
  and tablename in ('merchants','escape_events','daily_rollups',
                    'hourly_funnel_rollups','cart_attributions','merchant_members')
order by tablename, policyname;
```

Expected: only the new `member read` / `owner update` / `members self read` policies; no `self read` / `self insert` / `self update` remain on those tables.

- [ ] **Step 4: Manual smoke — existing dashboard unchanged**

Log in at the production dashboard (or `npm run dev` — note `SUPABASE.md`/local-dev caveat: Supabase env vars are marked Sensitive and can't be pulled; use prod if local env is missing) as an existing merchant owner. Expected: `/dashboard` renders identical data to before (KPIs, funnel, chart all populated).

- [ ] **Step 5: Append the new table + policies to `supabase/schema.sql`**

Copy the `merchant_members` table definition, its policy, both helper functions, and the five replaced policies from the migration into `supabase/schema.sql`, replacing the old policy blocks at lines 94–116 (the `merchants self read/insert/update`, `events self read`, `rollups self read` blocks).

- [ ] **Step 6: Commit and push**

```bash
git add supabase/migrations/20260706150000_multi_user_tenancy.sql supabase/schema.sql
git commit -m "feat(db): merchant_members tenancy foundation + membership RLS"
git push
```

---

### Task 2: Membership-based merchant resolution in `src/lib/db.ts`

**Files:**
- Modify: `src/lib/db.ts` (types near line 46; `getCurrentMerchant` at lines 114–153)

**Interfaces:**
- Consumes: `merchant_members` table + `members self read` policy (Task 1). FK `merchant_members.merchant_id → merchants.id` exists (Task 1), so PostgREST embed syntax `merchants ( ... )` is valid.
- Produces:
  - `type MemberRole = "owner" | "member" | "viewer"`
  - `type Membership = { merchant_id: string; role: MemberRole; name: string | null; domain: string | null }`
  - `getMemberships(): Promise<Membership[]>` — current user's memberships, oldest first
  - `getCurrentMerchant(): Promise<Merchant | null>` — same signature as today; resolution order: admin impersonation → `eh_active_merchant_id` cookie (validated against membership) → oldest membership → legacy `user_id` fallback
  - exported constant `ACTIVE_MERCHANT_COOKIE = "eh_active_merchant_id"`

- [ ] **Step 1: Add types, cookie constant, and `getMemberships()`**

In `src/lib/db.ts`, below the `Merchant` type (after line 65):

```ts
export const ACTIVE_MERCHANT_COOKIE = "eh_active_merchant_id";

export type MemberRole = "owner" | "member" | "viewer";

export type Membership = {
  merchant_id: string;
  role: MemberRole;
  name: string | null;
  domain: string | null;
};

type MembershipRow = {
  merchant_id: string;
  role: MemberRole;
  created_at: string;
  merchants: { id: string; name: string | null; domain: string | null } | null;
};

/** Current user's memberships, oldest first. Empty when logged out. */
export async function getMemberships(): Promise<Membership[]> {
  const supabase = await getSupabaseServer();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("merchant_members")
    .select("merchant_id, role, created_at, merchants ( id, name, domain )")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return ((data ?? []) as unknown as MembershipRow[]).map((r) => ({
    merchant_id: r.merchant_id,
    role: r.role,
    name: r.merchants?.name ?? null,
    domain: r.merchants?.domain ?? null,
  }));
}
```

- [ ] **Step 2: Rewrite `getCurrentMerchant()` to resolve via membership**

Replace the body after the impersonation block (lines 142–152, the `limit(1)` legacy lookup) with:

```ts
  // Membership resolution: active-merchant cookie (validated against the
  // user's memberships) → oldest membership → legacy user_id fallback.
  const memberships = await getMemberships();
  if (memberships.length > 0) {
    const cookieStore = await cookies();
    const activeId = cookieStore.get(ACTIVE_MERCHANT_COOKIE)?.value;
    const chosen =
      memberships.find((m) => m.merchant_id === activeId) ?? memberships[0];
    const { data } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", chosen.merchant_id)
      .maybeSingle();
    if (data) return data as Merchant;
  }

  // Legacy fallback: direct user_id ownership (backfill safety net).
  const { data } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  if (!data || data.length === 0) return null;
  return data[0] as Merchant;
```

The impersonation block (lines 122–140) stays byte-identical.

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 4: Manual smoke**

Log in as an existing owner. Expected: dashboard identical (now resolved via membership, not `user_id`). Admin: impersonate a merchant from `/admin/merchants`, confirm the impersonation banner and data still work, then exit.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/db.ts
git commit -m "feat(auth): resolve current merchant via merchant_members + active cookie"
git push
```

---

### Task 3: Auth callback — remove auto-create; dashboard no-workspace state

**Files:**
- Modify: `src/app/auth/callback/route.ts` (lines 25–36)
- Modify: `src/app/dashboard/layout.tsx` (lines 94, 309–313)

**Interfaces:**
- Consumes: `getMemberships()` from Task 2 (only conceptually — the layout uses `merchant === null` which Task 2 already makes membership-aware).
- Produces: users with a session but no membership see a "no workspace" card instead of a broken dashboard; no merchants row is ever created implicitly.

- [ ] **Step 1: Delete the auto-create block from the callback**

In `src/app/auth/callback/route.ts`, delete lines 25–36 (the comment `// First-time login: create a merchants row...` through the closing `}` of `if (user)`), leaving:

```ts
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
```

Also remove the now-unused destructured `user` fetch if nothing else references it (nothing else does).

- [ ] **Step 2: Replace the "Provisioning…" toast with a no-workspace card**

In `src/app/dashboard/layout.tsx`, after the `const { merchant, live } = merchantAndLive;` line (line 94), add an early return (before the main JSX, after all data fetching so hooks/order are unaffected — this is a server component, so an early return is safe):

```tsx
  if (!merchant) {
    return (
      <div className="min-h-dvh grid place-items-center px-5 bg-[var(--color-bg)] text-[var(--color-fg)]">
        <div className="max-w-md card-hi p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">No workspace yet</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
            Your account ({user.email}) isn&apos;t a member of any brand workspace.
            Ask your team owner for an invite, or contact us to get set up.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 text-sm">
            <a href="mailto:lenny@getescapehatch.com" className="text-[var(--color-accent)] link-grow">
              Contact us →
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

Then delete the old fallback at lines 309–313 (`{!merchant ? (<div className="fixed bottom-3 ...">Provisioning your merchant record…</div>) : null}`).

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: build succeeds. (Watch for `merchant` now being non-null after the early return — remove any redundant `merchant?.` optional chaining errors the compiler flags, but do not refactor beyond what it flags.)

- [ ] **Step 4: Manual smoke — fresh user gets no-workspace, not a phantom merchant**

Log in with a brand-new email (magic link to an address with no membership). Expected: the "No workspace yet" card. Verify in SQL (Supabase MCP `execute_sql`):

```sql
select count(*) from public.merchants where user_id is null and name is null
  and created_at > now() - interval '10 minutes';
```

Expected: `0` — no implicit merchant row was created.

- [ ] **Step 5: Commit and push**

```bash
git add src/app/auth/callback/route.ts src/app/dashboard/layout.tsx
git commit -m "feat(auth): stop auto-creating merchants; no-workspace state"
git push
```

---

### Task 4: Merchant switcher for multi-membership users

**Files:**
- Modify: `src/app/actions/merchant.ts` (append new action)
- Modify: `src/app/dashboard/_components/merchant-switcher.tsx`
- Modify: `src/app/dashboard/layout.tsx` (switcher wiring, lines 79–107 and both `<MerchantSwitcher>` call sites at lines 255–261 and 278–284)

**Interfaces:**
- Consumes: `getMemberships()`, `ACTIVE_MERCHANT_COOKIE` from Task 2 (`src/lib/db.ts`).
- Produces:
  - server action `setActiveMerchant(formData: FormData): Promise<void>` — reads `formData.get("id")`, validates membership, sets `eh_active_merchant_id` cookie, redirects to `/dashboard`
  - `MerchantSwitcher` gains prop `mode: "impersonate" | "switch"`; existing admin call sites pass `"impersonate"`

- [ ] **Step 1: Add `setActiveMerchant` server action**

Append to `src/app/actions/merchant.ts` (file already begins with `"use server";`):

```ts
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Switch the active workspace for a multi-membership user. Cookie is only
 *  honored by getCurrentMerchant when a matching membership row exists, so a
 *  forged cookie confers nothing — this validation is UX, not security. */
export async function setActiveMerchant(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) redirect("/dashboard");

  const supabase = await getSupabaseServer();
  if (!supabase) redirect("/dashboard");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("merchant_members")
    .select("merchant_id")
    .eq("user_id", user.id)
    .eq("merchant_id", id)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_MERCHANT_COOKIE, id, {
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

Add `import { cookies } from "next/headers";` to the file's imports if not present, and add `ACTIVE_MERCHANT_COOKIE` to the existing `@/lib/db` import. (If `src/lib/admin.ts` already exports a UUID regex, import that instead of redefining `UUID_RE` — check before adding.)

- [ ] **Step 2: Add `mode` prop to `MerchantSwitcher`**

In `src/app/dashboard/_components/merchant-switcher.tsx`:

1. Import the new action: `import { setActiveMerchant } from "@/app/actions/merchant";`
2. Extend props:

```ts
export function MerchantSwitcher({
  current,
  rows,
  impersonating,
  mode,
}: {
  current: { id: string; name: string | null; domain: string | null } | null;
  rows: SwitcherRow[];
  impersonating: boolean;
  mode: "impersonate" | "switch";
}) {
```

3. In the row `<form>` (line 76), choose the action by mode:

```tsx
<form key={r.id} action={mode === "impersonate" ? impersonateMerchant : setActiveMerchant} className="contents">
```

4. In the footer (lines 110–129): render the "Exit impersonation" form and the `Manage →` link to `/admin/merchants` only when `mode === "impersonate"`; in `"switch"` mode render the header label "Switch workspace" instead of "Switch merchant" and omit the footer entirely:

```tsx
{mode === "impersonate" ? (
  <div className="border-t border-[var(--color-border-soft)] flex items-center justify-between text-[11px]">
    {/* existing impersonation footer content, unchanged */}
  </div>
) : null}
```

- [ ] **Step 3: Wire non-admin switcher rows in the dashboard layout**

In `src/app/dashboard/layout.tsx`:

1. Import `getMemberships` from `@/lib/db`.
2. Add `getMemberships()` as a fourth member of the existing `Promise.all` (line 79):

```ts
const [merchantAndLive, impersonation, switcherDataRaw, memberships] = await Promise.all([
  /* three existing entries unchanged */,
  getMemberships(),
]);
```

3. After the admin `switcherRows` mapping (line 107), derive the final rows and mode:

```ts
  const memberRows: SwitcherRow[] = memberships.map((m) => ({
    id: m.merchant_id,
    name: m.name,
    domain: m.domain,
    ownedByMe: m.role === "owner",
  }));
  const switcherMode: "impersonate" | "switch" = isAdmin ? "impersonate" : "switch";
  const finalRows = isAdmin ? switcherRows : memberRows;
  const showSwitcher = isAdmin ? switcherRows.length > 0 : memberRows.length > 1;
```

4. At both call sites (mobile line 255, desktop line 278), replace the condition `isAdmin && switcherRows.length > 0` with `showSwitcher`, `rows={switcherRows}` with `rows={finalRows}`, and add `mode={switcherMode}`.

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual smoke**

1. Admin login: switcher behaves exactly as before (impersonate, banner, exit).
2. Regular single-membership owner: no switcher rendered (unchanged look).
3. Multi-membership check: via Supabase MCP `execute_sql`, temporarily add a second membership for your test user:

```sql
insert into public.merchant_members (merchant_id, user_id, role)
select m.id, u.id, 'viewer'
from public.merchants m, auth.users u
where u.email = '<your-test-email>' and m.user_id is distinct from u.id
limit 1;
```

Reload `/dashboard`: switcher appears with both workspaces; selecting the second one switches data and persists across reloads (cookie). Then delete the test row:

```sql
delete from public.merchant_members
where role = 'viewer'
  and user_id = (select id from auth.users where email = '<your-test-email>');
```

- [ ] **Step 6: Commit and push**

```bash
git add src/app/actions/merchant.ts src/app/dashboard/_components/merchant-switcher.tsx src/app/dashboard/layout.tsx
git commit -m "feat(dashboard): workspace switcher for multi-membership users"
git push
```

---

### Task 5: Phase 1 verification pass

**Files:**
- None created; verification only.

**Interfaces:**
- Consumes: everything above.
- Produces: confirmed green light for Phase 2 (invites).

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 2: RLS negative test — non-member cannot read another merchant's rows**

Via Supabase MCP `execute_sql` (simulating an authenticated user without membership):

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users order by created_at desc limit 1), 'role', 'authenticated')::text,
  true);
set local role authenticated;
select count(*) from public.merchants;
select count(*) from public.daily_rollups;
rollback;
```

Expected: both counts equal the number of merchants/rollups that user is a member of (`0` for a fresh test user) — NOT the full table counts.

- [ ] **Step 3: G FUEL gold-standard check**

Log in (or impersonate) the G FUEL merchant. Compare dashboard KPIs for the last 7 days against the same view from before Phase 1 (or against `hourly_funnel_rollups` totals via SQL). Expected: identical numbers — the migration is invisible.

- [ ] **Step 4: Mark phase complete**

If all green: Phase 2 (invites + team page + roles) gets its own plan. If anything failed, fix before proceeding — do not start Phase 2 on a broken foundation.
