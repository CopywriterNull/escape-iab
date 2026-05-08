-- Migration 0005 — RPC for the dashboard test funnel.
-- The default PostgREST max-rows cap (1000) was silently truncating the raw
-- event query in the dashboard. This RPC aggregates server-side, so the
-- response is at most ~12 rows regardless of event volume.

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
