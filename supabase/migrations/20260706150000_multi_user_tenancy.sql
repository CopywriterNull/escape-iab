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
