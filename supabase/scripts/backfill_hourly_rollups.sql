-- Backfill hourly_funnel_rollups for a date range, in safe chunks.
--
-- Use this any time the cron has lagged and rollups are missing data. The
-- 2026-05-26 blackout left a ~3-day hole from 2026-05-23 06:54 UTC; paste
-- this into the Supabase SQL Editor (or run via supabase db push from psql)
-- to fill it in.
--
-- Why chunked: the refresh RPC aggregates DISTINCT COUNT over potentially
-- millions of escape_events rows. Running it for >24h in one shot risks
-- the statement_timeout. 6h chunks keep each call under ~30s on current
-- SquidHaus+COVE volume.
--
-- Safe to re-run: the RPC deletes + reinserts only the rows in its window,
-- so running this over an already-backfilled range is a no-op aside from
-- some wasted aggregation work.

do $$
declare
  -- Edit these two lines to choose the backfill window.
  -- Defaults cover the 2026-05-26 SquidHaus blackout.
  v_start  timestamptz := timestamptz '2026-05-23 06:00:00+00';
  v_end    timestamptz := now();

  v_chunk      interval    := interval '6 hours';
  v_cursor     timestamptz := v_start;
  v_window_end timestamptz;
  v_inserted   integer;
begin
  raise notice 'Backfilling hourly rollups from % to % in % chunks', v_start, v_end, v_chunk;

  while v_cursor < v_end loop
    v_window_end := least(v_cursor + v_chunk, v_end);

    select public.eh_refresh_hourly_funnel_rollups(
      p_since := v_cursor,
      p_until := v_window_end
    )
    into v_inserted;

    raise notice '  %  →  %  · % rows', v_cursor, v_window_end, v_inserted;

    v_cursor := v_window_end;
  end loop;

  raise notice 'Backfill complete.';
end
$$;

-- Sanity check: hours covered per merchant in the last 4 days.
select
  m.name,
  count(*) filter (where h.hour >= now() - interval '24 hours')  as hours_last_24h,
  count(*) filter (where h.hour >= now() - interval '72 hours')  as hours_last_72h,
  count(*) filter (where h.hour >= now() - interval '96 hours')  as hours_last_96h,
  max(h.refreshed_at) as newest_refresh
from public.merchants m
left join public.hourly_funnel_rollups h on h.merchant_id = m.id
group by m.id, m.name
order by hours_last_96h desc nulls last;
