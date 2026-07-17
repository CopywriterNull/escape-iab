-- Per-merchant flag: when true, the storefront snippet stamps
-- utm_term=escapehatch-<bucket> (a=escape, b=control) on the landing URL,
-- only when utm_term is absent. Surfaces the A/B split inside the merchant's
-- own Shopify "Sessions/Orders by UTM term" report. Default off; enabled
-- manually for G FUEL + Kaiyo. Additive + defaulted so the `select *` in the
-- /s snippet route keeps serving while this rolls forward.
alter table merchants
  add column if not exists utm_tagging boolean not null default false;
