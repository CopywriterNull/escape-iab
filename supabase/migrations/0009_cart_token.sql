-- Migration 0009 — cart_token: the join key that actually works on Shopify.
--
-- Unlike _shopify_y cookies (which differ across storefront / checkout / Shop Pay
-- subdomains), cart_token is created when a cart is touched and is preserved
-- on the order via order.cart_token. It survives every checkout flow.

alter table public.escape_events add column if not exists cart_token text;
create index if not exists escape_events_merchant_cart_token_idx
  on public.escape_events(merchant_id, cart_token)
  where cart_token is not null;
