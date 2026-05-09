-- Migration 0008 — diagnostic cart_check event + unique-visitor impressions.

-- Add cart_check to allowed event types. Snippet beacons one of these per
-- visit after writing+reading /cart/update.json, so we can SEE whether the
-- Shopify cart attribute pipeline is actually working.
alter table public.escape_events drop constraint if exists escape_events_event_type_check;
alter table public.escape_events add constraint escape_events_event_type_check
  check (event_type in (
    'impression','iab_detected','escape_attempt','escape_skipped',
    'fallback_shown','fallback_clicked',
    'product_viewed','add_to_cart','checkout_started','purchase',
    'cart_check'
  ));

-- Replace funnel RPC: count distinct eh_sid for impressions (so the same
-- visitor's IAB-side + Safari-side post-escape pair counts once, not twice,
-- which was inflating bucket A 76/24 instead of the real 52/48).
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
  select all_stages.event_type, all_stages.bucket, all_stages.cnt, all_stages.revenue_cents
  from (
    -- Impressions: distinct eh_sid (or row id fallback for legacy events).
    select
      'impression'::text as event_type,
      e.bucket::text as bucket,
      count(distinct coalesce(e.eh_sid, e.id::text))::bigint as cnt,
      0::bigint as revenue_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id and e.in_test = true
      and e.created_at >= p_since
      and e.event_type = 'impression'
    group by e.bucket

    union all

    -- escape_attempt / escape_skipped / iab_detected / fallback_*: raw count.
    select
      e.event_type::text as event_type,
      e.bucket::text as bucket,
      count(*)::bigint as cnt,
      0::bigint as revenue_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id and e.in_test = true
      and e.created_at >= p_since
      and e.event_type in ('escape_attempt','escape_skipped','iab_detected','fallback_shown','fallback_clicked')
    group by e.event_type, e.bucket

    union all

    -- Funnel stages: count distinct shopify_client_id (pixel-side, where
    -- eh_sid was the bridge). Falls back to row id if neither is set.
    select
      e.event_type::text as event_type,
      e.bucket::text as bucket,
      count(distinct coalesce(e.shopify_client_id, e.eh_sid, e.id::text))::bigint as cnt,
      0::bigint as revenue_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id and e.in_test = true
      and e.created_at >= p_since
      and e.event_type in ('product_viewed','add_to_cart','checkout_started')
    group by e.event_type, e.bucket

    union all

    -- Purchases: unique orders + summed revenue.
    select
      'purchase'::text as event_type,
      p.bucket::text as bucket,
      count(distinct p.order_id)::bigint as cnt,
      coalesce(sum(p.value_per_order), 0)::bigint as revenue_cents
    from (
      select distinct on (order_id) bucket, order_id, value_cents as value_per_order
      from public.escape_events
      where merchant_id = p_merchant_id and in_test = true
        and event_type = 'purchase' and order_id is not null
        and created_at >= p_since
      order by order_id, created_at desc
    ) p
    group by p.bucket
  ) all_stages;
$$;

revoke all on function public.eh_test_funnel(uuid, timestamptz) from public;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to service_role;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to authenticated;
