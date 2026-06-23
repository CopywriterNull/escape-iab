-- Slim escape_events_dashboard_sources_idx: drop `url` from the INCLUDE list.
--
-- The old index was ~6GB (largest on the table) almost entirely because of the
-- `url` payload, and it is maintained on EVERY impression/purchase insert. The
-- only consumer, eh_test_sources, uses `url` solely as a FALLBACK to parse
-- utm_source when the utm_source column is empty:
--     coalesce(nullif(utm_source,''), substring(url from '...utm_source=...'), '(direct)')
-- Keeping utm_source in the INCLUDE keeps the common path index-only; the rare
-- empty-utm_source rows do a cheap heap fetch for url only when the sources card
-- is rendered (~hundreds of scans total). Net: ~4GB freed + lighter inserts.
--
-- MUST be run in a DURABLE session (Supabase SQL editor or psql) — a CREATE
-- INDEX CONCURRENTLY build aborts to an invalid index if the launching session
-- is torn down (e.g. an MCP/HTTP client timeout). CONCURRENTLY also cannot run
-- inside a transaction block, so run each statement on its own.

-- Step 1 (durable session, ~3-4 min online build; does not block writes):
create index concurrently if not exists escape_events_dashboard_sources_idx_v2
on public.escape_events (merchant_id, created_at desc, event_type)
include (bucket, value_cents, utm_source)
where (event_type in ('impression','purchase'));

-- Step 2 (only after v2 reports indisvalid = true): swap names.
drop index if exists public.escape_events_dashboard_sources_idx;
alter index escape_events_dashboard_sources_idx_v2
  rename to escape_events_dashboard_sources_idx;
