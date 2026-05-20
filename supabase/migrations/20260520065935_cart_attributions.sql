-- Narrow cart-token attribution store.
--
-- `cart_check` used to be written as a full escape_events row on nearly every
-- storefront pageview. We only need it to join Shopify order.cart_token back
-- to the visitor's assigned bucket, so keep that mapping here instead of
-- carrying URL/user-agent/UTM payloads through the hot analytics table.

create table if not exists public.cart_attributions (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  cart_token text not null,
  bucket text not null check (bucket in ('a', 'b')),
  in_test boolean not null default true,
  iab_kind text null,
  eh_sid text null,
  shopify_client_id text null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (merchant_id, cart_token)
);

create index if not exists cart_attributions_merchant_last_seen_idx
  on public.cart_attributions (merchant_id, last_seen_at desc);

create index if not exists cart_attributions_merchant_eh_sid_idx
  on public.cart_attributions (merchant_id, eh_sid)
  where eh_sid is not null;

alter table public.cart_attributions enable row level security;

drop policy if exists "cart attributions self read" on public.cart_attributions;
create policy "cart attributions self read" on public.cart_attributions
for select using (
  exists (
    select 1
    from public.merchants m
    where m.id = cart_attributions.merchant_id
      and m.user_id = auth.uid()
  )
);

insert into public.cart_attributions (
  merchant_id,
  cart_token,
  bucket,
  in_test,
  iab_kind,
  eh_sid,
  shopify_client_id,
  first_seen_at,
  last_seen_at
)
select distinct on (merchant_id, cart_token)
  merchant_id,
  cart_token,
  bucket,
  in_test,
  iab_kind,
  eh_sid,
  shopify_client_id,
  min(created_at) over (partition by merchant_id, cart_token) as first_seen_at,
  max(created_at) over (partition by merchant_id, cart_token) as last_seen_at
from public.escape_events
where event_type = 'cart_check'
  and cart_token is not null
order by merchant_id, cart_token, created_at desc
on conflict (merchant_id, cart_token) do update set
  bucket = excluded.bucket,
  in_test = excluded.in_test,
  iab_kind = excluded.iab_kind,
  eh_sid = excluded.eh_sid,
  shopify_client_id = excluded.shopify_client_id,
  first_seen_at = least(public.cart_attributions.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(public.cart_attributions.last_seen_at, excluded.last_seen_at);
