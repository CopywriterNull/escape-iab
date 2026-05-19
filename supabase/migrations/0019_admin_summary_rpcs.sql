-- Compact admin summaries so operator pages do not pull raw 24h event rows.

create or replace function public.eh_admin_platform_24h()
returns table (
  merchant_count bigint,
  events_24h bigint,
  live_merchants_24h bigint,
  purchases_24h bigint,
  revenue_cents_24h bigint
)
language sql
security definer
set search_path = public
as $$
  with recent as (
    select merchant_id, event_type, value_cents
    from public.escape_events
    where created_at >= now() - interval '24 hours'
  )
  select
    (select count(*) from public.merchants)::bigint as merchant_count,
    (select count(*) from recent)::bigint as events_24h,
    (select count(distinct merchant_id) from recent)::bigint as live_merchants_24h,
    (select count(*) from recent where event_type = 'purchase')::bigint as purchases_24h,
    coalesce((select sum(value_cents) from recent where event_type = 'purchase'), 0)::bigint as revenue_cents_24h;
$$;

create or replace function public.eh_admin_merchant_activity_24h()
returns table (
  merchant_id uuid,
  events_24h bigint,
  last_event_at timestamptz,
  last_event_type text
)
language sql
security definer
set search_path = public
as $$
  with recent as (
    select
      merchant_id,
      event_type,
      created_at,
      row_number() over (partition by merchant_id order by created_at desc) as rn
    from public.escape_events
    where created_at >= now() - interval '24 hours'
  )
  select
    merchant_id,
    count(*)::bigint as events_24h,
    max(created_at) as last_event_at,
    max(event_type) filter (where rn = 1) as last_event_type
  from recent
  group by merchant_id;
$$;

revoke all on function public.eh_admin_platform_24h() from public;
revoke all on function public.eh_admin_merchant_activity_24h() from public;
revoke all on function public.eh_admin_platform_24h() from anon;
revoke all on function public.eh_admin_merchant_activity_24h() from anon;
revoke all on function public.eh_admin_platform_24h() from authenticated;
revoke all on function public.eh_admin_merchant_activity_24h() from authenticated;
grant execute on function public.eh_admin_platform_24h() to service_role;
grant execute on function public.eh_admin_merchant_activity_24h() to service_role;
