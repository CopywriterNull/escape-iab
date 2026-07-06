-- EscapeHatch SQL schema. Run once in your Supabase project SQL editor.
-- Assumes Supabase auth.users is already present.

-- ============================================================================
-- merchants: one row per signed-up store. id = primary key referenced by
-- snippet/telemetry; user_id = owning auth.users row.
-- ============================================================================
create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  domain text,
  plan text not null default 'free',
  ab_enabled boolean not null default true,
  fallback_button boolean not null default true,
  escape_instagram boolean not null default true,
  escape_threads boolean not null default false,
  escape_facebook boolean not null default false,
  escape_messenger boolean not null default false,
  escape_discord boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists merchants_user_id_idx on public.merchants(user_id);

-- ============================================================================
-- escape_events: one row per beacon from the snippet. Hot path; keep narrow.
-- ============================================================================
create table if not exists public.escape_events (
  id bigserial primary key,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  event_type text not null check (event_type in (
    'impression','iab_detected','escape_attempt','escape_skipped',
    'fallback_shown','fallback_clicked','purchase'
  )),
  bucket text not null check (bucket in ('a','b')),
  is_ig boolean not null default false,
  iab_kind text check (iab_kind in (
    'instagram','threads','facebook','messenger','tiktok','snapchat','pinterest','discord','line','wechat','webview'
  )),
  shopify_client_id text,
  value_cents int,
  currency text,
  order_id text,
  url text,
  referrer text,
  user_agent text,
  ip_hash text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  created_at timestamptz not null default now()
);
create index if not exists escape_events_merchant_created_idx on public.escape_events(merchant_id, created_at desc);
create index if not exists escape_events_merchant_type_idx on public.escape_events(merchant_id, event_type);
create index if not exists escape_events_merchant_kind_idx on public.escape_events(merchant_id, iab_kind);
create index if not exists escape_events_merchant_sy_idx
  on public.escape_events(merchant_id, shopify_client_id, created_at desc)
  where shopify_client_id is not null;
create unique index if not exists escape_events_purchase_dedup
  on public.escape_events(merchant_id, order_id)
  where event_type = 'purchase' and order_id is not null;
create index if not exists escape_events_merchant_utm_idx
  on public.escape_events(merchant_id, utm_source);

-- ============================================================================
-- daily_rollups: pre-aggregated counts per merchant/day for fast dashboard.
-- We update this from the API route on insert, or via a scheduled job.
-- ============================================================================
create table if not exists public.daily_rollups (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  day date not null,
  bucket text not null check (bucket in ('a','b')),
  impressions int not null default 0,
  iab_detected int not null default 0,
  escape_attempts int not null default 0,
  escape_skipped int not null default 0,
  fallback_shown int not null default 0,
  fallback_clicked int not null default 0,
  purchases int not null default 0,
  revenue_cents bigint not null default 0,
  primary key (merchant_id, day, bucket)
);

-- ============================================================================
-- RLS: merchants own their rows; events readable only by owning merchant.
-- ============================================================================
alter table public.merchants enable row level security;
alter table public.escape_events enable row level security;
alter table public.daily_rollups enable row level security;

-- ============================================================================
-- merchant_members: multi-user tenancy (Phase 1). Source of truth for who
-- can access a merchant. merchants.user_id is retained as legacy.
-- ============================================================================
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
-- All WRITES go through the service-role client in server actions.
drop policy if exists "members self read" on public.merchant_members;
create policy "members self read" on public.merchant_members
  for select using (auth.uid() = user_id);

-- security definer helpers: keep policy bodies short and index-friendly.
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

-- ── Membership-based RLS (replaces legacy user_id-ownership policies) ───────

drop policy if exists "merchants self read" on public.merchants;
drop policy if exists "merchants member read" on public.merchants;
create policy "merchants member read" on public.merchants
  for select using (public.eh_is_member(id));

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

alter table public.hourly_funnel_rollups enable row level security;

drop policy if exists "hourly rollups self read" on public.hourly_funnel_rollups;
drop policy if exists "hourly rollups member read" on public.hourly_funnel_rollups;
create policy "hourly rollups member read" on public.hourly_funnel_rollups
  for select using (public.eh_is_member(merchant_id));

alter table public.cart_attributions enable row level security;

drop policy if exists "cart attributions self read" on public.cart_attributions;
drop policy if exists "cart attributions member read" on public.cart_attributions;
create policy "cart attributions member read" on public.cart_attributions
  for select using (public.eh_is_member(merchant_id));

-- ============================================================================
-- RPC: atomic daily-rollup increment. Called by /api/track.
-- ============================================================================
create or replace function public.eh_increment_rollup(
  p_merchant_id uuid,
  p_day date,
  p_bucket text,
  p_field text,
  p_revenue_cents int default 0
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.daily_rollups(merchant_id, day, bucket)
  values (p_merchant_id, p_day, p_bucket)
  on conflict (merchant_id, day, bucket) do nothing;

  if p_field = 'impressions' then
    update public.daily_rollups set impressions = impressions + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'iab_detected' then
    update public.daily_rollups set iab_detected = iab_detected + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'escape_attempts' then
    update public.daily_rollups set escape_attempts = escape_attempts + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'escape_skipped' then
    update public.daily_rollups set escape_skipped = escape_skipped + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'fallback_shown' then
    update public.daily_rollups set fallback_shown = fallback_shown + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'fallback_clicked' then
    update public.daily_rollups set fallback_clicked = fallback_clicked + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'purchases' then
    update public.daily_rollups
       set purchases = purchases + 1,
           revenue_cents = revenue_cents + greatest(coalesce(p_revenue_cents, 0), 0)
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  end if;
end; $$;

revoke all on function public.eh_increment_rollup(uuid, date, text, text, int) from public;
grant execute on function public.eh_increment_rollup(uuid, date, text, text, int) to service_role;
