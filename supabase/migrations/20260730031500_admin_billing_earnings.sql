-- Admin billing earnings rollup: one call returns, for every merchant,
-- (1) all-time per-bucket sums + first tracked hour (day IS NULL rows) and
-- (2) last-p_days per-bucket daily sums (day IS NOT NULL rows).
-- Feeds the /admin/billing earnings strip + daily accrual chart. Estimates
-- computed from these are UNTRIMMED (no outlier pass) — the invoice math in
-- computePeriodMetrics stays the authority on billable numbers.
create or replace function eh_admin_billing_earnings(p_days int default 30)
returns table (
  merchant_id uuid,
  day date,
  bucket text,
  impressions bigint,
  revenue_cents bigint,
  first_hour timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.merchant_id, null::date as day, r.bucket,
         coalesce(sum(r.impressions), 0)::bigint,
         coalesce(sum(r.revenue_cents), 0)::bigint,
         min(r.hour) as first_hour
  from hourly_funnel_rollups r
  group by r.merchant_id, r.bucket
  union all
  select r.merchant_id, (r.hour at time zone 'utc')::date as day, r.bucket,
         coalesce(sum(r.impressions), 0)::bigint,
         coalesce(sum(r.revenue_cents), 0)::bigint,
         null::timestamptz
  from hourly_funnel_rollups r
  where r.hour >= date_trunc('day', now() at time zone 'utc') - make_interval(days => p_days)
  group by r.merchant_id, 2, r.bucket
$$;

-- Security-definer + default PUBLIC execute would let anon-key callers pull
-- every merchant's revenue sums. Service-role only (admin pages).
revoke execute on function eh_admin_billing_earnings(int)
  from public, anon, authenticated;
grant execute on function eh_admin_billing_earnings(int)
  to service_role;
