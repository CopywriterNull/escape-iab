-- Per-store Shopify webhook signing secret. Shopify signs webhooks created via
-- Settings > Notifications with a per-STORE secret, so a single global
-- SHOPIFY_WEBHOOK_SECRET can only validate one store (this is why Huppy's order
-- webhooks were all 401 bad_hmac). The orders webhook now verifies HMAC against
-- this per-merchant secret first, falling back to the global app secret.
alter table public.merchants add column if not exists shopify_webhook_secret text;
