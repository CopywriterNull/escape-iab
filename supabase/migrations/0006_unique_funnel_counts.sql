-- Migration 0006 — dedup funnel stages by Shopify client_id.
--
-- Funnel stages downstream of impression (product_viewed, add_to_cart,
-- checkout_started) were raw counts. That over-counted in two ways:
--   1. The pixel's dual-transport (fetch + Image) writes 2 rows per pageview.
--   2. Visitors viewing the same product multiple times each fire a row.
--
-- For an A/B funnel, the right unit is "unique visitors who reached this
-- stage" — distinct Shopify client_id. Purchase already deduped by order_id.

create or replace function public.eh_test_funnel(
  p_merchant_id uuid,
  p_since timestamptz
) returns table (
  event_type text,
  bucket text,
  cnt bigint,
  revenue_cents bigint
)
language sql security definer set search_path = public as $$
  select event_type, bucket, cnt, revenue_cents
  from (
    -- Impressions + escape_attempts: raw count (one per pageview is
    -- intentional — measures reach, not unique users).
    select
      e.event_type,
      e.bucket,
      count(*)::bigint as cnt,
      0::bigint as revenue_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id
      and e.in_test = true
      and e.created_at >= p_since
      and e.event_type in ('impression','escape_attempt','escape_skipped','iab_detected','fallback_shown','fallback_clicked')
    group by e.event_type, e.bucket

    union all

    -- Funnel stages downstream of impression: count distinct Shopify visitors
    -- who reached each stage. Falls back to row id when client_id is null
    -- (rare; only happens if the pixel fired before _shopify_y was set).
    select
      e.event_type,
      e.bucket,
      count(distinct coalesce(e.shopify_client_id, e.id::text))::bigint as cnt,
      0::bigint as revenue_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id
      and e.in_test = true
      and e.created_at >= p_since
      and e.event_type in ('product_viewed','add_to_cart','checkout_started')
    group by e.event_type, e.bucket

    union all

    -- Purchases: unique orders (revenue summed across distinct orders).
    select
      'purchase'::text as event_type,
      bucket,
      count(distinct order_id)::bigint as cnt,
      coalesce(sum(value_per_order), 0)::bigint as revenue_cents
    from (
      select distinct on (order_id) bucket, order_id, value_cents as value_per_order
      from public.escape_events
      where merchant_id = p_merchant_id
        and in_test = true
        and event_type = 'purchase'
        and order_id is not null
        and created_at >= p_since
      order by order_id, created_at desc
    ) p
    group by bucket
  ) all_stages;
$$;

revoke all on function public.eh_test_funnel(uuid, timestamptz) from public;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to service_role;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to authenticated;
