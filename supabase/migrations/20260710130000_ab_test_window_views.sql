-- "A/B test" dashboard range: let a merchant view only the historical dates
-- when the A/B split was actually live (before they flipped ab_enabled off and
-- sent 100% of traffic to escape, collapsing bucket b to ~0). That period is
-- the only window with a credible randomized control, so per-visitor lift is
-- meaningful there. COVE ran May 19-25, SquidHaus May 19-27, then bucket b died.
--
-- Two problems this migration solves:
--  1. Detect the window per merchant (eh_ab_test_window).
--  2. Read a FIXED [since, until] window. The dashboard RPCs only took p_since
--     (implicitly -> now), so a historical window would drag in all the later
--     100%-escape days. We add a p_until bound to the funnel/sources/outlier
--     RPCs, and add a reliable windowed chart series (daily_rollups.impressions
--     is 0 after 2026-05-20 -- dead center of these windows -- so the chart must
--     come from hourly_funnel_rollups instead).

-- 1. Detector -------------------------------------------------------------
-- The A/B-live window = span of days where bucket b was a real participant
-- (>= 30 impressions AND >= 20% of bucket a that day). min..max of those days;
-- end_ts is exclusive (start of the day after the last live day). Returns no
-- row when fewer than 2 live days exist (nothing to show).
create or replace function public.eh_ab_test_window(p_merchant_id uuid)
returns table (start_ts timestamptz, end_ts timestamptz, start_day date, end_day date)
language sql
security definer
set search_path = public
as $$
  with d as (
    select
      date_trunc('day', hour) as day,
      sum(impressions) filter (where bucket = 'a') as a,
      sum(impressions) filter (where bucket = 'b') as b
    from public.hourly_funnel_rollups
    where merchant_id = p_merchant_id
    group by 1
  ),
  live as (
    select day
    from d
    where coalesce(b, 0) >= 30
      and coalesce(b, 0) >= 0.2 * greatest(coalesce(a, 0), 1)
  )
  select
    min(day)::timestamptz as start_ts,
    (max(day) + interval '1 day')::timestamptz as end_ts,
    min(day)::date as start_day,
    max(day)::date as end_day
  from live
  having count(*) >= 2;
$$;

revoke all on function public.eh_ab_test_window(uuid) from public, anon, authenticated;
grant execute on function public.eh_ab_test_window(uuid) to service_role;

-- 2. Funnel with an upper bound ------------------------------------------
-- Drop the 2-arg form first: adding a defaulted p_until would otherwise create
-- an overload and make 2-arg named calls ambiguous ("function is not unique").
drop function if exists public.eh_test_funnel(uuid, timestamptz);
create or replace function public.eh_test_funnel(
  p_merchant_id uuid,
  p_since timestamptz,
  p_until timestamptz default now()
)
returns table (event_type text, bucket text, cnt bigint, revenue_cents bigint)
language sql
security definer
set search_path = public
as $$
  with roll as (
    select *
    from public.hourly_funnel_rollups
    where merchant_id = p_merchant_id
      and hour >= date_trunc('hour', p_since)
      and hour < p_until
  ),
  agg as (
    select bucket, 'impression'::text as event_type, sum(impressions)::bigint as cnt, 0::bigint as revenue_cents from roll group by bucket
    union all
    select bucket, 'escape_attempt'::text, sum(escape_attempts)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'escape_skipped'::text, sum(escape_skipped)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'iab_detected'::text, sum(iab_detected)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'fallback_shown'::text, sum(fallback_shown)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'fallback_clicked'::text, sum(fallback_clicked)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'product_viewed'::text, sum(product_viewed)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'add_to_cart'::text, sum(add_to_cart)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'checkout_started'::text, sum(checkout_started)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'purchase'::text, sum(purchases)::bigint, sum(revenue_cents)::bigint from roll group by bucket
  )
  select event_type, bucket, coalesce(cnt, 0)::bigint, coalesce(revenue_cents, 0)::bigint
  from agg
  where coalesce(cnt, 0) <> 0
     or coalesce(revenue_cents, 0) <> 0;
$$;

-- Match the original grant exactly: service_role only (called via getSupabaseAdmin).
revoke all on function public.eh_test_funnel(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.eh_test_funnel(uuid, timestamptz, timestamptz) to service_role;

-- 3. Sources with an upper bound -----------------------------------------
drop function if exists public.eh_test_sources(uuid, timestamptz, integer);
create or replace function public.eh_test_sources(
  p_merchant_id uuid,
  p_since timestamptz,
  p_until timestamptz default now(),
  p_limit integer default 10
)
returns table (utm_source text, total bigint, bucket_a bigint, bucket_b bigint, purchases bigint, revenue_cents bigint)
language sql
security definer
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
  with impressions as (
    select
      bucket,
      coalesce(nullif(utm_source, ''), substring(url from '[?&]utm_source=([^&#]+)'), '(direct)') as src
    from public.escape_events
    where merchant_id = p_merchant_id
      and created_at >= p_since
      and created_at < p_until
      and in_test = true
      and event_type = 'impression'
  ),
  latest_purchases as (
    select distinct on (order_id)
      bucket,
      value_cents,
      coalesce(nullif(utm_source, ''), substring(url from '[?&]utm_source=([^&#]+)'), '(direct)') as src
    from public.escape_events
    where merchant_id = p_merchant_id
      and created_at >= p_since
      and created_at < p_until
      and in_test = true
      and event_type = 'purchase'
      and order_id is not null
    order by order_id, created_at desc
  ),
  impression_agg as (
    select src, count(*)::bigint as total,
      count(*) filter (where bucket = 'a')::bigint as bucket_a,
      count(*) filter (where bucket = 'b')::bigint as bucket_b
    from impressions group by src
  ),
  purchase_agg as (
    select src, count(*)::bigint as purchases, coalesce(sum(value_cents), 0)::bigint as revenue_cents
    from latest_purchases group by src
  ),
  source_keys as (
    select src from impression_agg union select src from purchase_agg
  )
  select
    k.src as utm_source,
    coalesce(i.total, 0)::bigint, coalesce(i.bucket_a, 0)::bigint, coalesce(i.bucket_b, 0)::bigint,
    coalesce(p.purchases, 0)::bigint, coalesce(p.revenue_cents, 0)::bigint
  from source_keys k
  left join impression_agg i on i.src = k.src
  left join purchase_agg p on p.src = k.src
  where coalesce(i.total, 0) > 0 or coalesce(p.purchases, 0) > 0
  order by coalesce(i.total, 0) desc, coalesce(p.purchases, 0) desc
  limit p_limit;
$$;

revoke all on function public.eh_test_sources(uuid, timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.eh_test_sources(uuid, timestamptz, timestamptz, integer) to service_role, authenticated;

-- 4. Outlier revenue with an upper bound ---------------------------------
drop function if exists public.eh_merchant_outlier_revenue(uuid, timestamptz);
create or replace function public.eh_merchant_outlier_revenue(
  p_merchant_id uuid,
  p_since timestamptz,
  p_until timestamptz default now()
)
returns table (bucket text, outlier_orders bigint, outlier_revenue_cents bigint)
language sql
security definer
set search_path = public
set plan_cache_mode = force_custom_plan
set work_mem = '64MB'
as $$
  with orders as (
    select e.bucket, e.value_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id
      and e.in_test = true
      and e.event_type = 'purchase'
      and e.order_id is not null
      and e.created_at >= p_since
      and e.created_at < p_until
      and e.bucket in ('a', 'b')
      and e.value_cents is not null
  ),
  fences as (
    select o.bucket, count(*) as n,
      percentile_cont(0.25) within group (order by o.value_cents) as q1,
      percentile_cont(0.50) within group (order by o.value_cents) as med,
      percentile_cont(0.75) within group (order by o.value_cents) as q3
    from orders o group by o.bucket
  )
  select
    o.bucket,
    count(*) filter (where f.n >= 8 and o.value_cents > f.q3 + 3 * (f.q3 - f.q1) and o.value_cents > 8 * f.med)::bigint,
    coalesce(sum(o.value_cents) filter (where f.n >= 8 and o.value_cents > f.q3 + 3 * (f.q3 - f.q1) and o.value_cents > 8 * f.med), 0)::bigint
  from orders o
  join fences f on f.bucket = o.bucket
  group by o.bucket;
$$;

revoke all on function public.eh_merchant_outlier_revenue(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.eh_merchant_outlier_revenue(uuid, timestamptz, timestamptz) to service_role;

-- 5. Reliable windowed chart series --------------------------------------
-- Same shape as daily_rollups rows the chart already consumes, but summed from
-- hourly_funnel_rollups (whose impressions are intact) and bounded to [since, until).
create or replace function public.eh_rollup_series_window(
  p_merchant_id uuid,
  p_since timestamptz,
  p_until timestamptz
)
returns table (
  merchant_id uuid, day date, bucket text,
  impressions bigint, iab_detected bigint, escape_attempts bigint, escape_skipped bigint,
  fallback_shown bigint, fallback_clicked bigint, product_viewed bigint, add_to_cart bigint,
  checkout_started bigint, purchases bigint, revenue_cents bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p_merchant_id,
    date_trunc('day', hour)::date as day,
    bucket,
    sum(impressions)::bigint, sum(iab_detected)::bigint, sum(escape_attempts)::bigint, sum(escape_skipped)::bigint,
    sum(fallback_shown)::bigint, sum(fallback_clicked)::bigint, sum(product_viewed)::bigint, sum(add_to_cart)::bigint,
    sum(checkout_started)::bigint, sum(purchases)::bigint, sum(revenue_cents)::bigint
  from public.hourly_funnel_rollups
  where merchant_id = p_merchant_id
    and hour >= p_since
    and hour < p_until
  group by date_trunc('day', hour)::date, bucket
  order by 2, 3;
$$;

revoke all on function public.eh_rollup_series_window(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.eh_rollup_series_window(uuid, timestamptz, timestamptz) to service_role, authenticated;
