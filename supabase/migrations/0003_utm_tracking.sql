-- Migration 0003 — UTM + click-id capture.
-- Idempotent. Run after 0002.

alter table public.escape_events add column if not exists utm_source text;
alter table public.escape_events add column if not exists utm_medium text;
alter table public.escape_events add column if not exists utm_campaign text;
alter table public.escape_events add column if not exists utm_content text;
alter table public.escape_events add column if not exists utm_term text;
alter table public.escape_events add column if not exists fbclid text;

create index if not exists escape_events_merchant_utm_idx
  on public.escape_events(merchant_id, utm_source);
