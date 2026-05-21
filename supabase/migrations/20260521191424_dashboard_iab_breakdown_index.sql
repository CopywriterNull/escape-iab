create index if not exists escape_events_iab_breakdown_idx
  on public.escape_events (merchant_id, created_at desc, iab_kind)
  where event_type = 'impression'
    and iab_kind is not null;
