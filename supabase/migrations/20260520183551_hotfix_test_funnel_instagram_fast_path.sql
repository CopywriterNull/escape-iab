-- Hotfix: keep the corrected denominator but use the indexed Instagram path.
-- The generic enabled-platform version was accurate but too slow for high
-- volume merchants on 14d/30d dashboard windows.
--
-- Current product default is Instagram reporting unless the merchant opts into
-- additional surfaces. The dashboard has been explicitly requested to focus on
-- IG traffic by default, so this fast path restores dashboard usability while
-- preserving the key fix: do not count post-escape browser impressions as new
-- bucket-A visitors.

create or replace function public.eh_test_funnel(
  p_merchant_id uuid,
  p_since timestamptz
) returns table (
  event_type text,
  bucket text,
  cnt bigint,
  revenue_cents bigint
)
language sql security definer
set search_path = public
set plan_cache_mode = force_custom_plan
set work_mem = '32MB'
as $$
  select all_stages.event_type, all_stages.bucket, all_stages.cnt, all_stages.revenue_cents
  from (
    -- Entry impressions only: original IG IAB side, excluding Safari/Chrome
    -- post-escape impressions that inflate bucket A.
    select
      'impression'::text as event_type,
      e.bucket::text as bucket,
      count(distinct e.eh_sid)::bigint as cnt,
      0::bigint as revenue_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id
      and e.in_test = true
      and e.created_at >= p_since
      and e.event_type = 'impression'
      and e.iab_kind = 'instagram'
      and e.eh_sid is not null
      and coalesce(e.url, '') not like '%opened_external_browser=true%'
    group by e.bucket

    union all

    -- Operational stages: IG IAB side only.
    select
      e.event_type::text as event_type,
      e.bucket::text as bucket,
      count(distinct coalesce(e.eh_sid, e.id::text))::bigint as cnt,
      0::bigint as revenue_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id
      and e.in_test = true
      and e.created_at >= p_since
      and e.iab_kind = 'instagram'
      and e.event_type in ('escape_attempt','escape_skipped','iab_detected','fallback_shown','fallback_clicked')
    group by e.event_type, e.bucket

    union all

    -- Pixel/webhook funnel stages can have null iab_kind after the browser
    -- handoff, so do not filter them by iab_kind.
    select
      e.event_type::text as event_type,
      e.bucket::text as bucket,
      count(distinct coalesce(e.shopify_client_id, e.eh_sid, e.id::text))::bigint as cnt,
      0::bigint as revenue_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id
      and e.in_test = true
      and e.created_at >= p_since
      and e.event_type in ('product_viewed','add_to_cart','checkout_started')
    group by e.event_type, e.bucket

    union all

    -- Purchases: unique attributed orders, with null-iab_kind preserved for
    -- cart/session joins that happen after the escape.
    select
      'purchase'::text as event_type,
      p.bucket::text as bucket,
      count(*)::bigint as cnt,
      coalesce(sum(p.value_cents), 0)::bigint as revenue_cents
    from (
      select distinct on (merchant_id, order_id)
        merchant_id,
        bucket,
        order_id,
        value_cents
      from public.escape_events
      where merchant_id = p_merchant_id
        and in_test = true
        and created_at >= p_since
        and event_type = 'purchase'
        and order_id is not null
      order by merchant_id, order_id, created_at desc
    ) p
    group by p.bucket
  ) all_stages;
$$;

revoke all on function public.eh_test_funnel(uuid, timestamptz) from public;
revoke all on function public.eh_test_funnel(uuid, timestamptz) from anon;
revoke all on function public.eh_test_funnel(uuid, timestamptz) from authenticated;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to service_role;
