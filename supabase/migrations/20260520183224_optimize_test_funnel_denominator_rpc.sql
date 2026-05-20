-- Keep the corrected entry-impression denominator from
-- 20260520165149_fix_test_funnel_entry_denominator, but avoid scanning
-- `escape_events` repeatedly. Larger merchants can time out on dashboard
-- ranges when the RPC performs several independent aggregates.

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
set work_mem = '64MB'
as $$
  with cfg as (
    select
      coalesce(escape_instagram, true) as instagram,
      coalesce(escape_threads, false) as threads,
      coalesce(escape_facebook, false) as facebook,
      coalesce(escape_messenger, false) as messenger,
      coalesce(escape_discord, false) as discord
    from public.merchants
    where id = p_merchant_id
  ),
  base as materialized (
    select
      e.id,
      e.event_type,
      e.bucket,
      e.iab_kind,
      e.eh_sid,
      e.shopify_client_id,
      e.order_id,
      e.value_cents,
      e.url,
      (
        (c.instagram and e.iab_kind = 'instagram') or
        (c.threads and e.iab_kind = 'threads') or
        (c.facebook and e.iab_kind = 'facebook') or
        (c.messenger and e.iab_kind = 'messenger') or
        (c.discord and e.iab_kind = 'discord')
      ) as enabled_iab_kind
    from public.escape_events e
    cross join cfg c
    where e.merchant_id = p_merchant_id
      and e.in_test = true
      and e.created_at >= p_since
      and e.event_type in (
        'impression',
        'escape_attempt',
        'escape_skipped',
        'iab_detected',
        'fallback_shown',
        'fallback_clicked',
        'product_viewed',
        'add_to_cart',
        'checkout_started',
        'purchase'
      )
  ),
  entry_impressions as (
    select
      'impression'::text as event_type,
      bucket::text as bucket,
      count(distinct eh_sid)::bigint as cnt,
      0::bigint as revenue_cents
    from base
    where event_type = 'impression'
      and eh_sid is not null
      and enabled_iab_kind
      and coalesce(url, '') not like '%opened_external_browser=true%'
    group by bucket
  ),
  operational_events as (
    select
      event_type::text,
      bucket::text,
      count(distinct coalesce(eh_sid, id::text))::bigint as cnt,
      0::bigint as revenue_cents
    from base
    where event_type in ('escape_attempt','escape_skipped','iab_detected','fallback_shown','fallback_clicked')
      and (enabled_iab_kind or iab_kind is null)
    group by event_type, bucket
  ),
  funnel_events as (
    select
      event_type::text,
      bucket::text,
      count(distinct coalesce(shopify_client_id, eh_sid, id::text))::bigint as cnt,
      0::bigint as revenue_cents
    from base
    where event_type in ('product_viewed','add_to_cart','checkout_started')
    group by event_type, bucket
  ),
  latest_purchases as (
    select distinct on (order_id)
      bucket,
      order_id,
      value_cents
    from base
    where event_type = 'purchase'
      and order_id is not null
    order by order_id, id desc
  ),
  purchase_events as (
    select
      'purchase'::text as event_type,
      bucket::text as bucket,
      count(*)::bigint as cnt,
      coalesce(sum(value_cents), 0)::bigint as revenue_cents
    from latest_purchases
    group by bucket
  )
  select * from entry_impressions
  union all
  select * from operational_events
  union all
  select * from funnel_events
  union all
  select * from purchase_events;
$$;

revoke all on function public.eh_test_funnel(uuid, timestamptz) from public;
revoke all on function public.eh_test_funnel(uuid, timestamptz) from anon;
revoke all on function public.eh_test_funnel(uuid, timestamptz) from authenticated;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to service_role;
