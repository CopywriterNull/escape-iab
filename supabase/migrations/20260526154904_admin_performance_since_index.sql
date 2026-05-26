-- Admin/performance reads all active merchants over a recent window. The older
-- admin impression index is merchant-first, which is good for one merchant but
-- makes all-brand 24h queries scan too much historical data before applying
-- the time predicate.

create index if not exists escape_events_admin_ig_impressions_since_idx
  on public.escape_events (created_at desc, merchant_id, bucket, eh_sid)
  include (url)
  where in_test = true
    and iab_kind = 'instagram'
    and event_type = 'impression'
    and eh_sid is not null;
