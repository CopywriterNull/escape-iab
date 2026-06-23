-- Prevent rollup refresh timeouts at high-volume merchants (COVE/SquidHaus).
-- The count(distinct ...) aggregations in the funnel rollup RPCs spill to disk
-- at the default work_mem, which pushed wide windows past the function timeout
-- and contributed to the 2026-06-15 -> 2026-06-23 rollup freeze. Pinning
-- work_mem on the functions lets 24-48h windows finish in-memory.
alter function public.eh_refresh_hourly_funnel_rollups_for_merchant(uuid, timestamptz, timestamptz)
  set work_mem = '256MB';
alter function public.eh_refresh_hourly_funnel_rollups(timestamptz, timestamptz)
  set work_mem = '256MB';
