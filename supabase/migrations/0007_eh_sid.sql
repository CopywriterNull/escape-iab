-- Migration 0007 — eh_sid: independent visitor tracking ID we control.
--
-- Survives the Shopify checkout cookie-jar break that was causing
-- pixel checkout_completed events to fail attribution. Used as a fallback
-- join key when shopify_client_id doesn't match.

alter table public.escape_events add column if not exists eh_sid text;
create index if not exists escape_events_merchant_eh_sid_idx
  on public.escape_events(merchant_id, eh_sid)
  where eh_sid is not null;
