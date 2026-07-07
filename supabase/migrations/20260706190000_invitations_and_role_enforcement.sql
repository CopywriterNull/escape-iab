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
