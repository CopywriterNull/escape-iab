-- Revenue-per-visitor on the admin performance page is a per-visitor mean, so a
-- single whale order on a small sample can flip a brand's lift red even when
-- escape is winning on orders and conversion. NotJustSundays (be87e9f8) is the
-- canonical case: one $3,200 control-bucket order (median order ~$41) was 51% of
-- its 14d control revenue and dragged the 14d RPV lift to -36% while escape had
-- MORE orders (87 vs 67) and higher CVR (14.0% vs 11.0%).
--
-- The hourly_funnel_rollups only store aggregated revenue_cents per
-- (merchant, hour, bucket) -- individual order values are gone -- so the page
-- cannot subtract an outlier from the rollup. This RPC recomputes, per
-- (merchant, bucket) over the same window, how much revenue came from
-- statistically extreme orders, using order-level rows in escape_events.
--
-- Outlier definition (conservative on purpose -- must survive client scrutiny):
--   an order is an outlier only if BOTH
--     value_cents > Q3 + 3*IQR         (Tukey "far out" fence -- extreme, not mild)
--     value_cents > 8 * median          (an order of magnitude above typical)
--   and the bucket has >= 8 orders       (IQR/median unstable below that)
-- Both conditions spare legitimately larger-than-average orders (e.g. a $116
-- order in a $41-median bucket) and only catch true whales.
--
-- Reads only in-test purchase rows (matches the rollup's in_test=true revenue)
-- and is shaped to hit escape_events_admin_test_purchases_idx
-- (created_at DESC, merchant_id, order_id) INCLUDE (bucket, value_cents)
-- WHERE in_test AND event_type='purchase' AND order_id IS NOT NULL.

create or replace function public.eh_admin_brand_performance_outliers(
  p_since timestamptz
)
returns table (
  merchant_id uuid,
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
    select e.merchant_id, e.bucket, e.value_cents
    from public.escape_events e
    where e.in_test = true
      and e.event_type = 'purchase'
      and e.order_id is not null
      and e.created_at >= p_since
      and e.bucket in ('a', 'b')
      and e.value_cents is not null
  ),
  fences as (
    select
      o.merchant_id,
      o.bucket,
      count(*) as n,
      percentile_cont(0.25) within group (order by o.value_cents) as q1,
      percentile_cont(0.50) within group (order by o.value_cents) as med,
      percentile_cont(0.75) within group (order by o.value_cents) as q3
    from orders o
    group by o.merchant_id, o.bucket
  )
  select
    o.merchant_id,
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
  join fences f
    on f.merchant_id = o.merchant_id
   and f.bucket = o.bucket
  group by o.merchant_id, o.bucket
  having count(*) filter (
      where f.n >= 8
        and o.value_cents > f.q3 + 3 * (f.q3 - f.q1)
        and o.value_cents > 8 * f.med
    ) > 0;
$$;

revoke all on function public.eh_admin_brand_performance_outliers(timestamptz) from public;
revoke all on function public.eh_admin_brand_performance_outliers(timestamptz) from anon;
revoke all on function public.eh_admin_brand_performance_outliers(timestamptz) from authenticated;
grant execute on function public.eh_admin_brand_performance_outliers(timestamptz) to service_role;
