-- escape_events_iab_funnel_cover_idx was an invalid (failed CREATE INDEX
-- CONCURRENTLY) leftover: indisvalid=false, 0 bytes, 0 scans. The planner can
-- never use it; it is pure catalog dead weight. Drop it.
drop index if exists public.escape_events_iab_funnel_cover_idx;
