-- Per-merchant sibling of eh_admin_brand_performance_outliers, for the
-- merchant-facing dashboard (getTestFunnel). The hourly_funnel_rollups only
-- keep aggregated revenue_cents, so the dashboard can't subtract a whale order
-- from a bucket; this returns how much of a bucket's revenue came from
-- statistically extreme orders so the funnel can trim it.
--
-- Same conservative rule as the admin RPC (must survive merchant scrutiny):
--   outlier iff value_cents > Q3 + 3*IQR AND value_cents > 8*median,
--   and the bucket has >= 8 orders.
-- Scoped to one merchant so it hits escape_events_admin_test_purchases_idx
-- (created_at DESC, merchant_id, order_id) INCLUDE (bucket, value_cents)
-- for a single-merchant window and stays cheap.

create or replace function public.eh_merchant_outlier_revenue(
  p_merchant_id uuid,
  p_since timestamptz
)
returns table (
  bucket text,
  outlier_orders bigint,
  outlier_revenue_cents bigint
)
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
      and e.bucket in ('a', 'b')
      and e.value_cents is not null
  ),
  fences as (
    select
      o.bucket,
      count(*) as n,
      percentile_cont(0.25) within group (order by o.value_cents) as q1,
      percentile_cont(0.50) within group (order by o.value_cents) as med,
      percentile_cont(0.75) within group (order by o.value_cents) as q3
    from orders o
    group by o.bucket
  )
  select
    o.bucket,
    count(*) filter (
      where f.n >= 8
        and o.value_cents > f.q3 + 3 * (f.q3 - f.q1)
        and o.value_cents > 8 * f.med
    )::bigint as outlier_orders,
    coalesce(sum(o.value_cents) filter (
      where f.n >= 8
        and o.value_cents > f.q3 + 3 * (f.q3 - f.q1)
        and o.value_cents > 8 * f.med
    ), 0)::bigint as outlier_revenue_cents
  from orders o
  join fences f on f.bucket = o.bucket
  group by o.bucket;
$$;

revoke all on function public.eh_merchant_outlier_revenue(uuid, timestamptz) from public;
revoke all on function public.eh_merchant_outlier_revenue(uuid, timestamptz) from anon;
revoke all on function public.eh_merchant_outlier_revenue(uuid, timestamptz) from authenticated;
grant execute on function public.eh_merchant_outlier_revenue(uuid, timestamptz) to service_role;
