-- Migration 0012 — paid_only toggle on merchants.
--
-- When true (default), the snippet only escapes Meta IAB visitors that
-- arrived via paid clicks (fbclid present, or utm_source in
-- {facebook,instagram,fb,ig,meta} with utm_medium in {paid,cpc,ad}).
--
-- When false, the snippet escapes ANY Meta IAB visitor — organic IG
-- link-in-bio clicks, story link taps, DM shares, etc. Recommended for
-- stores with strong organic IG presence that want to recover all paid
-- + organic checkout breakage.

alter table public.merchants
  add column if not exists paid_only boolean not null default true;
