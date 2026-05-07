-- Migration 0001 — multi-IAB detection support.
-- Run after the original schema.sql if you already applied it. Idempotent.

-- Drop and re-add the event_type CHECK constraint to include new types.
alter table public.escape_events drop constraint if exists escape_events_event_type_check;
alter table public.escape_events add constraint escape_events_event_type_check
  check (event_type in (
    'impression','iab_detected','escape_attempt','escape_skipped','fallback_shown','fallback_clicked'
  ));

-- New column: which IAB the visitor came from.
alter table public.escape_events add column if not exists iab_kind text
  check (iab_kind in (
    'instagram','facebook','messenger','tiktok','snapchat','pinterest','line','wechat','webview'
  ));
create index if not exists escape_events_merchant_kind_idx on public.escape_events(merchant_id, iab_kind);

-- Extend daily_rollups to count the new event types.
alter table public.daily_rollups add column if not exists iab_detected int not null default 0;
alter table public.daily_rollups add column if not exists escape_skipped int not null default 0;

-- Replace the rollup RPC with the new field handlers.
create or replace function public.eh_increment_rollup(
  p_merchant_id uuid,
  p_day date,
  p_bucket text,
  p_field text
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
  end if;
end; $$;
