-- The raw admin performance RPC timed out on high-volume 24h windows because
-- it counted distinct IG impression sessions across escape_events. Use the
-- corrected hourly rollups instead; those are refreshed by the retention cron.

create or replace function public.eh_admin_brand_performance(
  p_since timestamptz
)
returns table (
  merchant_id uuid,
  merchant_name text,
  merchant_domain text,
  ab_enabled boolean,
  ab_split_pct integer,
  impressions_a bigint,
  impressions_b bigint,
  escapes_a bigint,
  purchases_a bigint,
  purchases_b bigint,
  revenue_cents_a bigint,
  revenue_cents_b bigint
)
language sql
security definer
set search_path = public
set plan_cache_mode = force_custom_plan
set work_mem = '32MB'
as $$
  with merchants_base as (
    select id, name, domain, ab_enabled, ab_split_pct
    from public.merchants
  ),
  perf as (
    select
      h.merchant_id,
      coalesce(sum(h.impressions) filter (where h.bucket = 'a'), 0)::bigint as impressions_a,
      coalesce(sum(h.impressions) filter (where h.bucket = 'b'), 0)::bigint as impressions_b,
      coalesce(sum(h.escape_attempts) filter (where h.bucket = 'a'), 0)::bigint as escapes_a,
      coalesce(sum(h.purchases) filter (where h.bucket = 'a'), 0)::bigint as purchases_a,
      coalesce(sum(h.purchases) filter (where h.bucket = 'b'), 0)::bigint as purchases_b,
      coalesce(sum(h.revenue_cents) filter (where h.bucket = 'a'), 0)::bigint as revenue_cents_a,
      coalesce(sum(h.revenue_cents) filter (where h.bucket = 'b'), 0)::bigint as revenue_cents_b
    from public.hourly_funnel_rollups h
    where h.hour >= date_trunc('hour', p_since)
    group by h.merchant_id
  )
  select
    m.id as merchant_id,
    m.name as merchant_name,
    m.domain as merchant_domain,
    coalesce(m.ab_enabled, true) as ab_enabled,
    coalesce(m.ab_split_pct, 50) as ab_split_pct,
    coalesce(p.impressions_a, 0)::bigint as impressions_a,
    coalesce(p.impressions_b, 0)::bigint as impressions_b,
    coalesce(p.escapes_a, 0)::bigint as escapes_a,
    coalesce(p.purchases_a, 0)::bigint as purchases_a,
    coalesce(p.purchases_b, 0)::bigint as purchases_b,
    coalesce(p.revenue_cents_a, 0)::bigint as revenue_cents_a,
    coalesce(p.revenue_cents_b, 0)::bigint as revenue_cents_b
  from merchants_base m
  left join perf p on p.merchant_id = m.id
  order by coalesce(p.impressions_a, 0) + coalesce(p.impressions_b, 0) desc, m.name;
$$;

revoke all on function public.eh_admin_brand_performance(timestamptz) from public;
revoke all on function public.eh_admin_brand_performance(timestamptz) from anon;
revoke all on function public.eh_admin_brand_performance(timestamptz) from authenticated;
grant execute on function public.eh_admin_brand_performance(timestamptz) to service_role;
