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
  created_at timestamptz not null default now()
);
create index if not exists merchants_user_id_idx on public.merchants(user_id);

-- ============================================================================
-- escape_events: one row per beacon from the snippet. Hot path; keep narrow.
-- ============================================================================
create table if not exists public.escape_events (
  id bigserial primary key,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  event_type text not null check (event_type in ('impression','escape_attempt','fallback_shown','fallback_clicked')),
  bucket text not null check (bucket in ('a','b')),
  is_ig boolean not null default false,
  url text,
  referrer text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists escape_events_merchant_created_idx on public.escape_events(merchant_id, created_at desc);
create index if not exists escape_events_merchant_type_idx on public.escape_events(merchant_id, event_type);

-- ============================================================================
-- daily_rollups: pre-aggregated counts per merchant/day for fast dashboard.
-- We update this from the API route on insert, or via a scheduled job.
-- ============================================================================
create table if not exists public.daily_rollups (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  day date not null,
  bucket text not null check (bucket in ('a','b')),
  impressions int not null default 0,
  escape_attempts int not null default 0,
  fallback_shown int not null default 0,
  fallback_clicked int not null default 0,
  primary key (merchant_id, day, bucket)
);

-- ============================================================================
-- RLS: merchants own their rows; events readable only by owning merchant.
-- ============================================================================
alter table public.merchants enable row level security;
alter table public.escape_events enable row level security;
alter table public.daily_rollups enable row level security;

drop policy if exists "merchants self read" on public.merchants;
create policy "merchants self read" on public.merchants
  for select using (auth.uid() = user_id);

drop policy if exists "merchants self insert" on public.merchants;
create policy "merchants self insert" on public.merchants
  for insert with check (auth.uid() = user_id);

drop policy if exists "merchants self update" on public.merchants;
create policy "merchants self update" on public.merchants
  for update using (auth.uid() = user_id);

drop policy if exists "events self read" on public.escape_events;
create policy "events self read" on public.escape_events
  for select using (
    exists (select 1 from public.merchants m where m.id = merchant_id and m.user_id = auth.uid())
  );

drop policy if exists "rollups self read" on public.daily_rollups;
create policy "rollups self read" on public.daily_rollups
  for select using (
    exists (select 1 from public.merchants m where m.id = merchant_id and m.user_id = auth.uid())
  );

-- ============================================================================
-- RPC: atomic daily-rollup increment. Called by /api/track.
-- ============================================================================
create or replace function public.eh_increment_rollup(
  p_merchant_id uuid,
  p_day date,
  p_bucket text,
  p_field text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.daily_rollups(merchant_id, day, bucket, impressions, escape_attempts, fallback_shown, fallback_clicked)
  values (p_merchant_id, p_day, p_bucket, 0, 0, 0, 0)
  on conflict (merchant_id, day, bucket) do nothing;

  if p_field = 'impressions' then
    update public.daily_rollups set impressions = impressions + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'escape_attempts' then
    update public.daily_rollups set escape_attempts = escape_attempts + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'fallback_shown' then
    update public.daily_rollups set fallback_shown = fallback_shown + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'fallback_clicked' then
    update public.daily_rollups set fallback_clicked = fallback_clicked + 1
      where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  end if;
end; $$;

revoke all on function public.eh_increment_rollup(uuid, date, text, text) from public;
grant execute on function public.eh_increment_rollup(uuid, date, text, text) to service_role;
