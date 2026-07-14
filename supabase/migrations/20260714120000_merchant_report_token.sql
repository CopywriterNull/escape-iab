-- Public, no-login report links. Each merchant gets an unguessable report_token;
-- the public route /r/[token] resolves the merchant by it (service-role only,
-- no enumeration) and renders the read-only test readout. Revoke/rotate by
-- nulling or regenerating the token. RLS unchanged — the token is a capability,
-- resolved server-side with the admin client, never exposed to the anon role.
alter table public.merchants
  add column if not exists report_token text;

create unique index if not exists merchants_report_token_key
  on public.merchants (report_token)
  where report_token is not null;
