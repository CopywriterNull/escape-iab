-- Migration 0002 — purchase attribution via Shopify Customer Events.
-- Idempotent. Run after 0001_iab_kinds.sql.

-- Add the new event type to the CHECK constraint.
alter table public.escape_events drop constraint if exists escape_events_event_type_check;
alter table public.escape_events add constraint escape_events_event_type_check
  check (event_type in (
    'impression','iab_detected','escape_attempt','escape_skipped',
    'fallback_shown','fallback_clicked','purchase'
  ));

-- New columns for purchase attribution.
alter table public.escape_events add column if not exists shopify_client_id text;
alter table public.escape_events add column if not exists value_cents int;
alter table public.escape_events add column if not exists currency text;
alter table public.escape_events add column if not exists order_id text;

-- Fast lookup by Shopify client_id (for the impression → purchase join).
create index if not exists escape_events_merchant_sy_idx
  on public.escape_events(merchant_id, shopify_client_id, created_at desc)
  where shopify_client_id is not null;

-- Dedup purchases per merchant per order.
create unique index if not exists escape_events_purchase_dedup
  on public.escape_events(merchant_id, order_id)
  where event_type = 'purchase' and order_id is not null;

-- Rollup: add purchase count + revenue.
alter table public.daily_rollups add column if not exists purchases int not null default 0;
alter table public.daily_rollups add column if not exists revenue_cents bigint not null default 0;

-- Replace rollup RPC to handle purchases (with revenue param).
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

-- Old 4-arg signature is now superseded; keep it for backward compat by forwarding.
create or replace function public.eh_increment_rollup(
  p_merchant_id uuid,
  p_day date,
  p_bucket text,
  p_field text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.eh_increment_rollup(p_merchant_id, p_day, p_bucket, p_field, 0);
end; $$;

revoke all on function public.eh_increment_rollup(uuid, date, text, text, int) from public;
grant execute on function public.eh_increment_rollup(uuid, date, text, text, int) to service_role;
