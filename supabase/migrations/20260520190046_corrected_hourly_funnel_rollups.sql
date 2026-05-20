-- Corrected hourly funnel rollups.
--
-- The existing daily_rollups table is cheap but counts raw increments and can
-- include post-escape impressions. This table stores the same semantics as the
-- corrected dashboard funnel:
-- - impressions = unique IG IAB entry visitors only
-- - downstream funnel stages = unique visitors
-- - purchases = unique attributed orders

create table if not exists public.hourly_funnel_rollups (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  hour timestamptz not null,
  bucket text not null check (bucket in ('a','b')),
  impressions bigint not null default 0,
  escape_attempts bigint not null default 0,
  escape_skipped bigint not null default 0,
  iab_detected bigint not null default 0,
  fallback_shown bigint not null default 0,
  fallback_clicked bigint not null default 0,
  product_viewed bigint not null default 0,
  add_to_cart bigint not null default 0,
  checkout_started bigint not null default 0,
  purchases bigint not null default 0,
  revenue_cents bigint not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key (merchant_id, hour, bucket)
);

create index if not exists hourly_funnel_rollups_merchant_hour_idx
  on public.hourly_funnel_rollups (merchant_id, hour desc);

alter table public.hourly_funnel_rollups enable row level security;

drop policy if exists "hourly rollups self read" on public.hourly_funnel_rollups;
create policy "hourly rollups self read" on public.hourly_funnel_rollups
  for select using (
    exists (
      select 1
      from public.merchants m
      where m.id = hourly_funnel_rollups.merchant_id
        and m.user_id = (select auth.uid())
    )
  );

create or replace function public.eh_refresh_hourly_funnel_rollups(
  p_since timestamptz default now() - interval '35 days',
  p_until timestamptz default now()
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := date_trunc('hour', p_since);
  v_end timestamptz := date_trunc('hour', p_until);
  v_rows integer := 0;
begin
  delete from public.hourly_funnel_rollups
  where hour >= v_start
    and hour <= v_end;

  insert into public.hourly_funnel_rollups (
    merchant_id,
    hour,
    bucket,
    impressions,
    escape_attempts,
    escape_skipped,
    iab_detected,
    fallback_shown,
    fallback_clicked,
    product_viewed,
    add_to_cart,
    checkout_started,
    purchases,
    revenue_cents,
    refreshed_at
  )
  with base as (
    select
      merchant_id,
      date_trunc('hour', created_at) as hour,
      bucket,
      event_type,
      iab_kind,
      eh_sid,
      shopify_client_id,
      order_id,
      value_cents,
      url
    from public.escape_events
    where created_at >= v_start
      and created_at < v_end + interval '1 hour'
      and in_test = true
      and event_type in (
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
  event_counts as (
    select
      merchant_id,
      hour,
      bucket,
      count(distinct eh_sid) filter (
        where event_type = 'impression'
          and iab_kind = 'instagram'
          and eh_sid is not null
          and coalesce(url, '') not like '%opened_external_browser=true%'
      )::bigint as impressions,
      count(distinct coalesce(eh_sid, merchant_id::text || '-' || hour::text || '-' || bucket || '-escape_attempt')) filter (
        where event_type = 'escape_attempt' and iab_kind = 'instagram'
      )::bigint as escape_attempts,
      count(distinct coalesce(eh_sid, merchant_id::text || '-' || hour::text || '-' || bucket || '-escape_skipped')) filter (
        where event_type = 'escape_skipped' and iab_kind = 'instagram'
      )::bigint as escape_skipped,
      count(distinct coalesce(eh_sid, merchant_id::text || '-' || hour::text || '-' || bucket || '-iab_detected')) filter (
        where event_type = 'iab_detected' and iab_kind = 'instagram'
      )::bigint as iab_detected,
      count(distinct coalesce(eh_sid, merchant_id::text || '-' || hour::text || '-' || bucket || '-fallback_shown')) filter (
        where event_type = 'fallback_shown' and iab_kind = 'instagram'
      )::bigint as fallback_shown,
      count(distinct coalesce(eh_sid, merchant_id::text || '-' || hour::text || '-' || bucket || '-fallback_clicked')) filter (
        where event_type = 'fallback_clicked' and iab_kind = 'instagram'
      )::bigint as fallback_clicked,
      count(distinct coalesce(shopify_client_id, eh_sid, order_id)) filter (where event_type = 'product_viewed')::bigint as product_viewed,
      count(distinct coalesce(shopify_client_id, eh_sid, order_id)) filter (where event_type = 'add_to_cart')::bigint as add_to_cart,
      count(distinct coalesce(shopify_client_id, eh_sid, order_id)) filter (where event_type = 'checkout_started')::bigint as checkout_started
    from base
    where event_type <> 'purchase'
    group by merchant_id, hour, bucket
  ),
  purchases as (
    select
      merchant_id,
      hour,
      bucket,
      count(*)::bigint as purchases,
      coalesce(sum(value_cents), 0)::bigint as revenue_cents
    from (
      select distinct on (merchant_id, order_id)
        merchant_id,
        date_trunc('hour', created_at) as hour,
        bucket,
        value_cents,
        order_id
      from public.escape_events
      where created_at >= v_start
        and created_at < v_end + interval '1 hour'
        and in_test = true
        and event_type = 'purchase'
        and order_id is not null
      order by merchant_id, order_id, created_at desc
    ) p
    group by merchant_id, hour, bucket
  ),
  keys as (
    select merchant_id, hour, bucket from event_counts
    union
    select merchant_id, hour, bucket from purchases
  )
  select
    k.merchant_id,
    k.hour,
    k.bucket,
    coalesce(e.impressions, 0),
    coalesce(e.escape_attempts, 0),
    coalesce(e.escape_skipped, 0),
    coalesce(e.iab_detected, 0),
    coalesce(e.fallback_shown, 0),
    coalesce(e.fallback_clicked, 0),
    coalesce(e.product_viewed, 0),
    coalesce(e.add_to_cart, 0),
    coalesce(e.checkout_started, 0),
    coalesce(p.purchases, 0),
    coalesce(p.revenue_cents, 0),
    now()
  from keys k
  left join event_counts e
    on e.merchant_id = k.merchant_id
   and e.hour = k.hour
   and e.bucket = k.bucket
  left join purchases p
    on p.merchant_id = k.merchant_id
   and p.hour = k.hour
   and p.bucket = k.bucket;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

create or replace function public.eh_test_funnel(
  p_merchant_id uuid,
  p_since timestamptz
) returns table (
  event_type text,
  bucket text,
  cnt bigint,
  revenue_cents bigint
)
language sql
security definer
set search_path = public
as $$
  with roll as (
    select *
    from public.hourly_funnel_rollups
    where merchant_id = p_merchant_id
      and hour >= date_trunc('hour', p_since)
  ),
  agg as (
    select bucket, 'impression'::text as event_type, sum(impressions)::bigint as cnt, 0::bigint as revenue_cents from roll group by bucket
    union all
    select bucket, 'escape_attempt'::text, sum(escape_attempts)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'escape_skipped'::text, sum(escape_skipped)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'iab_detected'::text, sum(iab_detected)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'fallback_shown'::text, sum(fallback_shown)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'fallback_clicked'::text, sum(fallback_clicked)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'product_viewed'::text, sum(product_viewed)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'add_to_cart'::text, sum(add_to_cart)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'checkout_started'::text, sum(checkout_started)::bigint, 0::bigint from roll group by bucket
    union all
    select bucket, 'purchase'::text, sum(purchases)::bigint, sum(revenue_cents)::bigint from roll group by bucket
  )
  select event_type, bucket, coalesce(cnt, 0)::bigint, coalesce(revenue_cents, 0)::bigint
  from agg
  where coalesce(cnt, 0) <> 0
     or coalesce(revenue_cents, 0) <> 0;
$$;

revoke all on function public.eh_refresh_hourly_funnel_rollups(timestamptz, timestamptz) from public;
revoke all on function public.eh_refresh_hourly_funnel_rollups(timestamptz, timestamptz) from anon;
revoke all on function public.eh_refresh_hourly_funnel_rollups(timestamptz, timestamptz) from authenticated;
grant execute on function public.eh_refresh_hourly_funnel_rollups(timestamptz, timestamptz) to service_role;

revoke all on function public.eh_test_funnel(uuid, timestamptz) from public;
revoke all on function public.eh_test_funnel(uuid, timestamptz) from anon;
revoke all on function public.eh_test_funnel(uuid, timestamptz) from authenticated;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to service_role;
