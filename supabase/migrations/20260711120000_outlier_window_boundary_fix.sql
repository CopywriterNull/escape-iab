-- Fix: outlier detection missed whales sitting in the boundary hour of the
-- window, so trimming silently did nothing and the dashboard stayed red.
--
-- eh_test_funnel / eh_admin_brand_performance read hourly_funnel_rollups with
-- `hour >= date_trunc('hour', p_since)` — i.e. the window start is rounded DOWN
-- to the hour, so the whole boundary hour is counted. But the outlier RPCs used
-- the EXACT `created_at >= p_since`, excluding up to 59 minutes of that boundary
-- hour. A whale in that gap was counted in revenue but invisible to the trim.
--
-- NJS case (2026-07-11): the $3,200 control order at 06-27 17:21 was inside the
-- funnel window (>= 17:00) but outside the outlier window (>= 17:29), so 0
-- outliers were removed and the hero showed -36.3%. Aligning the lower bound to
-- date_trunc('hour', p_since) makes the trimmer see exactly what the funnel
-- counts (+33.7% once trimmed).

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
      and e.created_at >= date_trunc('hour', p_since)
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
  select o.bucket,
    count(*) filter (where f.n >= 8 and o.value_cents > f.q3 + 3 * (f.q3 - f.q1) and o.value_cents > 8 * f.med)::bigint,
    coalesce(sum(o.value_cents) filter (where f.n >= 8 and o.value_cents > f.q3 + 3 * (f.q3 - f.q1) and o.value_cents > 8 * f.med), 0)::bigint
  from orders o
  join fences f on f.bucket = o.bucket
  group by o.bucket;
$$;

revoke all on function public.eh_merchant_outlier_revenue(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.eh_merchant_outlier_revenue(uuid, timestamptz, timestamptz) to service_role;

create or replace function public.eh_admin_brand_performance_outliers(
  p_since timestamptz
)
returns table (merchant_id uuid, bucket text, outlier_orders bigint, outlier_revenue_cents bigint)
language sql
security definer
set search_path = public
set plan_cache_mode = force_custom_plan
set work_mem = '64MB'
as $$
  with orders as (
    select e.merchant_id, e.bucket, e.value_cents
    from public.escape_events e
    where e.in_test = true
      and e.event_type = 'purchase'
      and e.order_id is not null
      and e.created_at >= date_trunc('hour', p_since)
      and e.bucket in ('a', 'b')
      and e.value_cents is not null
  ),
  fences as (
    select o.merchant_id, o.bucket, count(*) as n,
      percentile_cont(0.25) within group (order by o.value_cents) as q1,
      percentile_cont(0.50) within group (order by o.value_cents) as med,
      percentile_cont(0.75) within group (order by o.value_cents) as q3
    from orders o group by o.merchant_id, o.bucket
  )
  select o.merchant_id, o.bucket,
    count(*) filter (where f.n >= 8 and o.value_cents > f.q3 + 3 * (f.q3 - f.q1) and o.value_cents > 8 * f.med)::bigint,
    coalesce(sum(o.value_cents) filter (where f.n >= 8 and o.value_cents > f.q3 + 3 * (f.q3 - f.q1) and o.value_cents > 8 * f.med), 0)::bigint
  from orders o
  join fences f on f.merchant_id = o.merchant_id and f.bucket = o.bucket
  group by o.merchant_id, o.bucket
  having count(*) filter (where f.n >= 8 and o.value_cents > f.q3 + 3 * (f.q3 - f.q1) and o.value_cents > 8 * f.med) > 0;
$$;

revoke all on function public.eh_admin_brand_performance_outliers(timestamptz) from public, anon, authenticated;
grant execute on function public.eh_admin_brand_performance_outliers(timestamptz) to service_role;
