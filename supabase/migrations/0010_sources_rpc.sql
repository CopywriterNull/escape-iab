-- Migration 0010 — server-side aggregation for the Top Sources card.
--
-- Before: dashboard pulled up to 20,000 raw rows over the wire and aggregated
-- in JavaScript. Slow + lossy past 20k events in the range.
-- After: single grouped query in Postgres, returns ~10 rows.
--
-- Semantics match the prior JS exactly:
--   total/bucket_a/bucket_b count IMPRESSION events only (traffic indicator)
--   purchases/revenue_cents count PURCHASE events only.

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
language sql security definer set search_path = public as $$
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
