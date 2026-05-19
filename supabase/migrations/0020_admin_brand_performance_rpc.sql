-- Brand-level A/B performance summary for the admin exec dashboard.
-- Uses unique IG IAB visitors as the denominator so bucket A is not inflated by
-- the post-escape Safari/Chrome impression.

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
as $$
  with merchants_base as (
    select id, name, domain, ab_enabled, ab_split_pct
    from public.merchants
  ),
  impressions as (
    select
      e.merchant_id,
      count(distinct e.eh_sid) filter (where e.bucket = 'a')::bigint as impressions_a,
      count(distinct e.eh_sid) filter (where e.bucket = 'b')::bigint as impressions_b
    from public.escape_events e
    where e.created_at >= p_since
      and e.in_test = true
      and e.iab_kind = 'instagram'
      and e.event_type = 'impression'
      and e.eh_sid is not null
      and coalesce(e.url, '') not like '%opened_external_browser=true%'
    group by e.merchant_id
  ),
  escapes as (
    select
      merchant_id,
      count(distinct eh_sid) filter (where bucket = 'a')::bigint as escapes_a
    from public.escape_events
    where created_at >= p_since
      and in_test = true
      and iab_kind = 'instagram'
      and event_type = 'escape_attempt'
      and eh_sid is not null
    group by merchant_id
  ),
  purchases as (
    select
      merchant_id,
      count(*) filter (where bucket = 'a')::bigint as purchases_a,
      count(*) filter (where bucket = 'b')::bigint as purchases_b,
      coalesce(sum(value_cents) filter (where bucket = 'a'), 0)::bigint as revenue_cents_a,
      coalesce(sum(value_cents) filter (where bucket = 'b'), 0)::bigint as revenue_cents_b
    from (
      select distinct on (merchant_id, order_id)
        merchant_id,
        bucket,
        order_id,
        value_cents
      from public.escape_events
      where created_at >= p_since
        and in_test = true
        and iab_kind = 'instagram'
        and event_type = 'purchase'
        and order_id is not null
      order by merchant_id, order_id, created_at desc
    ) p
    group by merchant_id
  )
  select
    m.id as merchant_id,
    m.name as merchant_name,
    m.domain as merchant_domain,
    coalesce(m.ab_enabled, true) as ab_enabled,
    coalesce(m.ab_split_pct, 50) as ab_split_pct,
    coalesce(i.impressions_a, 0)::bigint as impressions_a,
    coalesce(i.impressions_b, 0)::bigint as impressions_b,
    coalesce(e.escapes_a, 0)::bigint as escapes_a,
    coalesce(p.purchases_a, 0)::bigint as purchases_a,
    coalesce(p.purchases_b, 0)::bigint as purchases_b,
    coalesce(p.revenue_cents_a, 0)::bigint as revenue_cents_a,
    coalesce(p.revenue_cents_b, 0)::bigint as revenue_cents_b
  from merchants_base m
  left join impressions i on i.merchant_id = m.id
  left join escapes e on e.merchant_id = m.id
  left join purchases p on p.merchant_id = m.id
  order by coalesce(i.impressions_a, 0) + coalesce(i.impressions_b, 0) desc, m.name;
$$;

revoke all on function public.eh_admin_brand_performance(timestamptz) from public;
revoke all on function public.eh_admin_brand_performance(timestamptz) from anon;
revoke all on function public.eh_admin_brand_performance(timestamptz) from authenticated;
grant execute on function public.eh_admin_brand_performance(timestamptz) to service_role;
