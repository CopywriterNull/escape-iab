-- Migration 0014 — multi-tenant webhook routing.
--
-- Add shopify_domain (the merchant's *.myshopify.com admin domain) so the
-- Shopify order webhook handler can identify which merchant an incoming
-- order belongs to via the X-Shopify-Shop-Domain header.
--
-- Existing single-merchant behavior is preserved: if no row matches the
-- header, the handler falls back to the SHOPIFY_WEBHOOK_MERCHANT_ID env
-- var (G FUEL today).

alter table public.merchants
  add column if not exists shopify_domain text;

-- Backfill G FUEL with its known Shopify admin domain so the new routing
-- path matches the same merchant the env var used to point to.
update public.merchants
set shopify_domain = 'gfuel.myshopify.com'
where id = '8b6e80c0-88fd-4c9e-acab-39e21e6d7154'
  and shopify_domain is null;

create index if not exists merchants_shopify_domain_idx
  on public.merchants (shopify_domain);
