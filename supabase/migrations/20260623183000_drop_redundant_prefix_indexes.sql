-- Drop two indexes that are strict leading-column prefixes of a wider existing
-- index with the same partial predicate. The planner can serve their lookups
-- from the superset, so this removes per-insert maintenance on the hot
-- /api/track path and frees ~626MB with no query coverage loss.
--   merchant_in_test_idx (merchant_id, in_test, event_type)
--     subset of funnel_rpc_idx (merchant_id, in_test, event_type, bucket, created_at)
--   merchant_eh_sid_idx (merchant_id, eh_sid) WHERE eh_sid IS NOT NULL
--     subset of eh_sid_join_idx (merchant_id, eh_sid, event_type, in_test, created_at) WHERE eh_sid IS NOT NULL
drop index if exists public.escape_events_merchant_in_test_idx;
drop index if exists public.escape_events_merchant_eh_sid_idx;
