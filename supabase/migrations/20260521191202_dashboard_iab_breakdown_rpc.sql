create or replace function public.eh_iab_breakdown(
  p_merchant_id uuid,
  p_since timestamptz
)
returns table (
  iab_kind text,
  impressions bigint
)
language sql
security definer
set search_path = public
as $$
  select
    e.iab_kind,
    count(*)::bigint as impressions
  from public.escape_events e
  where e.merchant_id = p_merchant_id
    and e.created_at >= p_since
    and e.event_type = 'impression'
    and e.iab_kind is not null
  group by e.iab_kind
  order by impressions desc;
$$;

revoke all on function public.eh_iab_breakdown(uuid, timestamptz) from public;
revoke all on function public.eh_iab_breakdown(uuid, timestamptz) from anon;
revoke all on function public.eh_iab_breakdown(uuid, timestamptz) from authenticated;
grant execute on function public.eh_iab_breakdown(uuid, timestamptz) to service_role;
