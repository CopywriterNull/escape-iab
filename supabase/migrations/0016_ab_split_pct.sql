-- 0016 — configurable A/B split per merchant.
--
-- ab_split_pct = percent of in-test traffic placed in bucket A (the
-- "escape" arm). Bucket B is the silent control. 50 = even 50/50 split
-- (legacy behavior). 70 = 70% escape, 30% control. The two-proportion
-- z-test on the dashboard handles unequal sample sizes natively.
--
-- Range is clamped to [1, 99] in the snippet builder and the settings
-- action — values at the extremes defeat the purpose of an A/B (100
-- means "no control"; 0 means "no escape"). Merchants who want 100%
-- escape should flip ab_enabled off instead.

alter table public.merchants
  add column if not exists ab_split_pct int not null default 50;

-- Backfill any pre-existing rows that somehow ended up null (shouldn't
-- happen given the NOT NULL default, but defensive).
update public.merchants
  set ab_split_pct = 50
  where ab_split_pct is null;

-- Range guard at the DB level. Matches the snippet builder's clamp.
alter table public.merchants
  drop constraint if exists merchants_ab_split_pct_range;
alter table public.merchants
  add constraint merchants_ab_split_pct_range
  check (ab_split_pct between 1 and 99);
