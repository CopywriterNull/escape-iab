-- Keep high-write tracking tables eligible for index-only scans.
--
-- The dashboard's 24h exact fallback depends on recent partial indexes over
-- escape_events. After a burst of writes/deletes, Postgres can stop trusting
-- those index-only scans until VACUUM refreshes the visibility map; SquidHaus
-- 24h queries jumped from ~1s to ~26s when that map went stale. Tighten
-- autovacuum/analyze thresholds so this table is cleaned long before the
-- dashboard has to scan tens of thousands of fresh event rows through heap
-- pages.

alter table public.escape_events set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 5000,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 5000
);
