-- Migration 0004 — funnel events: product_viewed, add_to_cart, checkout_started.
-- Also adds in_test boolean to mark events from the constrained test population
-- (paid IG ad clicks in IG IAB) vs. all other traffic.
-- Idempotent.

alter table public.escape_events drop constraint if exists escape_events_event_type_check;
alter table public.escape_events add constraint escape_events_event_type_check
  check (event_type in (
    'impression','iab_detected','escape_attempt','escape_skipped',
    'fallback_shown','fallback_clicked',
    'product_viewed','add_to_cart','checkout_started','purchase'
  ));

alter table public.escape_events add column if not exists in_test boolean not null default true;
create index if not exists escape_events_merchant_in_test_idx
  on public.escape_events(merchant_id, in_test, event_type);

alter table public.daily_rollups add column if not exists product_viewed int not null default 0;
alter table public.daily_rollups add column if not exists add_to_cart int not null default 0;
alter table public.daily_rollups add column if not exists checkout_started int not null default 0;

drop function if exists public.eh_increment_rollup(uuid, date, text, text, int);
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
  if p_field = 'impressions' then update public.daily_rollups set impressions = impressions + 1 where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'iab_detected' then update public.daily_rollups set iab_detected = iab_detected + 1 where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'escape_attempts' then update public.daily_rollups set escape_attempts = escape_attempts + 1 where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'escape_skipped' then update public.daily_rollups set escape_skipped = escape_skipped + 1 where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'fallback_shown' then update public.daily_rollups set fallback_shown = fallback_shown + 1 where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'fallback_clicked' then update public.daily_rollups set fallback_clicked = fallback_clicked + 1 where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'product_viewed' then update public.daily_rollups set product_viewed = product_viewed + 1 where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'add_to_cart' then update public.daily_rollups set add_to_cart = add_to_cart + 1 where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'checkout_started' then update public.daily_rollups set checkout_started = checkout_started + 1 where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  elsif p_field = 'purchases' then update public.daily_rollups set purchases = purchases + 1, revenue_cents = revenue_cents + greatest(coalesce(p_revenue_cents, 0), 0) where merchant_id = p_merchant_id and day = p_day and bucket = p_bucket;
  end if;
end; $$;
revoke all on function public.eh_increment_rollup(uuid, date, text, text, int) from public;
grant execute on function public.eh_increment_rollup(uuid, date, text, text, int) to service_role;
