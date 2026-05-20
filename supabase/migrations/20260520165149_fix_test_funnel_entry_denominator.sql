-- Dashboard A/B funnel denominator fix.
--
-- `eh_test_funnel` was reverted in 0017 to raw in-test counts for every event
-- type. That made bucket A look artificially worse for merchants with lots of
-- successful escapes: post-escape browser-side impressions are bucket A,
-- `in_test=true`, and often have `iab_kind=null`, so they were counted as new
-- visitors. The test denominator should be the initial enabled IAB impression,
-- not the follow-up Safari/Chrome impression.

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
as $$
  with merchant_scope as (
    select
      coalesce(escape_instagram, true) as instagram,
      coalesce(escape_threads, false) as threads,
      coalesce(escape_facebook, false) as facebook,
      coalesce(escape_messenger, false) as messenger,
      coalesce(escape_discord, false) as discord
    from public.merchants
    where id = p_merchant_id
  ),
  enabled_kinds as (
    select unnest(array[
      case when instagram then 'instagram' end,
      case when threads then 'threads' end,
      case when facebook then 'facebook' end,
      case when messenger then 'messenger' end,
      case when discord then 'discord' end
    ])::text as iab_kind
    from merchant_scope
  ),
  entry_impressions as (
    select
      e.bucket::text as bucket,
      count(distinct e.eh_sid)::bigint as cnt
    from public.escape_events e
    where e.merchant_id = p_merchant_id
      and e.in_test = true
      and e.created_at >= p_since
      and e.event_type = 'impression'
      and e.eh_sid is not null
      and e.iab_kind in (select iab_kind from enabled_kinds where iab_kind is not null)
      and coalesce(e.url, '') not like '%opened_external_browser=true%'
    group by e.bucket
  ),
  operational_events as (
    select
      e.event_type::text as event_type,
      e.bucket::text as bucket,
      count(distinct coalesce(e.eh_sid, e.id::text))::bigint as cnt,
      0::bigint as revenue_cents
    from public.escape_events e
    where e.merchant_id = p_merchant_id
      and e.in_test = true
      and e.created_at >= p_since
      and e.event_type in ('escape_attempt','escape_skipped','iab_detected','fallback_shown','fallback_clicked')
      and (
        e.iab_kind in (select iab_kind from enabled_kinds where iab_kind is not null)
        or e.iab_kind is null
      )
    group by e.event_type, e.bucket
  ),
  funnel_events as (
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
  ),
  purchase_events as (
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
  )
  select 'impression'::text as event_type, bucket, cnt, 0::bigint as revenue_cents
  from entry_impressions
  union all
  select event_type, bucket, cnt, revenue_cents from operational_events
  union all
  select event_type, bucket, cnt, revenue_cents from funnel_events
  union all
  select event_type, bucket, cnt, revenue_cents from purchase_events;
$$;

revoke all on function public.eh_test_funnel(uuid, timestamptz) from public;
revoke all on function public.eh_test_funnel(uuid, timestamptz) from anon;
revoke all on function public.eh_test_funnel(uuid, timestamptz) from authenticated;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to service_role;
