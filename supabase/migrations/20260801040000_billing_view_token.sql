-- Stable merchant-facing billing view token. Unlike billing_setup_token
-- (rotates on every copy; redirects to Stripe Checkout), this one is minted
-- once and reused — the merchant bookmarks it.
alter table merchants add column if not exists billing_view_token text unique;
