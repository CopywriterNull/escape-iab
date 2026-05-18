-- Migration 0017 — dashboard read performance + cheaper RLS.
--
-- Live symptoms:
-- - eh_test_funnel / eh_test_sources were taking 7-15s once escape_events
--   crossed ~280k rows.
-- - Supabase advisor flagged auth.uid() policies as per-row initplans.

-- These indexes are intentionally CONCURRENTLY because escape_events is a hot
-- ingest table. Run this file outside an explicit transaction.
create index concurrently if not exists escape_events_dashboard_funnel_idx
  on public.escape_events (merchant_id, in_test, created_at desc, event_type, bucket)
  include (value_cents);

create index concurrently if not exists escape_events_funnel_rpc_idx
  on public.escape_events (merchant_id, in_test, event_type, bucket, created_at desc)
  include (value_cents);

create index concurrently if not exists escape_events_dashboard_sources_idx
  on public.escape_events (merchant_id, created_at desc, event_type)
  include (bucket, value_cents, utm_source, url)
  where event_type in ('impression', 'purchase');

create index concurrently if not exists escape_events_eh_sid_join_idx
  on public.escape_events (merchant_id, eh_sid, event_type, in_test, created_at desc)
  include (bucket)
  where eh_sid is not null;

create index concurrently if not exists escape_events_fbclid_join_idx
  on public.escape_events (merchant_id, fbclid, event_type, in_test, created_at desc)
  include (bucket)
  where fbclid is not null;

create index concurrently if not exists escape_events_cart_token_join_idx
  on public.escape_events (merchant_id, cart_token, in_test, created_at desc)
  include (bucket)
  where cart_token is not null;

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
  select
    e.event_type,
    e.bucket,
    count(*)::bigint as cnt,
    coalesce(sum(e.value_cents), 0)::bigint as revenue_cents
  from public.escape_events e
  where e.merchant_id = p_merchant_id
    and e.in_test = true
    and e.created_at >= p_since
  group by e.event_type, e.bucket;
$$;

revoke all on function public.eh_test_funnel(uuid, timestamptz) from public;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to service_role;
grant execute on function public.eh_test_funnel(uuid, timestamptz) to authenticated;

create or replace function public.eh_test_sources(
  p_merchant_id uuid,
  p_since timestamptz,
  p_limit int default 10
) returns table (
  utm_source text,
  total bigint,
  bucket_a bigint,
  bucket_b bigint,
  purchases bigint,
  revenue_cents bigint
)
language sql security definer
set search_path = public
set plan_cache_mode = force_custom_plan
as $$
  with normalized as (
    select
      bucket,
      event_type,
      value_cents,
      coalesce(
        nullif(utm_source, ''),
        substring(url from '[?&]utm_source=([^&#]+)'),
        '(direct)'
      ) as src
    from public.escape_events
    where merchant_id = p_merchant_id
      and created_at >= p_since
      and event_type in ('impression', 'purchase')
  )
  select
    src as utm_source,
    count(*) filter (where event_type = 'impression')::bigint as total,
    count(*) filter (where event_type = 'impression' and bucket = 'a')::bigint as bucket_a,
    count(*) filter (where event_type = 'impression' and bucket = 'b')::bigint as bucket_b,
    count(*) filter (where event_type = 'purchase')::bigint as purchases,
    coalesce(sum(value_cents) filter (where event_type = 'purchase'), 0)::bigint as revenue_cents
  from normalized
  group by src
  having count(*) filter (where event_type = 'impression') > 0
      or count(*) filter (where event_type = 'purchase') > 0
  order by count(*) filter (where event_type = 'impression') desc, count(*) desc
  limit p_limit;
$$;

revoke all on function public.eh_test_sources(uuid, timestamptz, int) from public;
grant execute on function public.eh_test_sources(uuid, timestamptz, int) to service_role;
grant execute on function public.eh_test_sources(uuid, timestamptz, int) to authenticated;

drop policy if exists "merchants self read" on public.merchants;
create policy "merchants self read" on public.merchants
  for select using ((select auth.uid()) = user_id);

drop policy if exists "merchants self insert" on public.merchants;
create policy "merchants self insert" on public.merchants
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "merchants self update" on public.merchants;
create policy "merchants self update" on public.merchants
  for update using ((select auth.uid()) = user_id);

drop policy if exists "events self read" on public.escape_events;
create policy "events self read" on public.escape_events
  for select using (
    exists (
      select 1
      from public.merchants m
      where m.id = merchant_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "rollups self read" on public.daily_rollups;
create policy "rollups self read" on public.daily_rollups
  for select using (
    exists (
      select 1
      from public.merchants m
      where m.id = merchant_id
        and m.user_id = (select auth.uid())
    )
  );
