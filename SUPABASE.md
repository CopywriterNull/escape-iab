# Supabase Data Notes

Last updated: 2026-05-20

This file tracks the database and Supabase-side decisions for Escape Hatch: what was optimized, what is working, what is still risky, and how to measure value once a merchant moves from a 50/50 test to 100% rollout.

## Current Shape

- `escape_events` is the raw event ledger. It is still the source of truth for impression, escape, product, cart, checkout, and purchase events.
- `daily_rollups` powers older day-grain dashboard trends and period-over-period cards.
- `hourly_funnel_rollups` now powers the dashboard A/B funnel RPC for recent ranges, especially high-volume merchants like COVE.
- Purchase attribution comes from Shopify order webhooks and pixel purchase events where available.
- Dashboard metrics should be scoped to the enabled in-app browser platforms for each merchant, Instagram-only by default unless the merchant has Facebook, Threads, Messenger, or other sources enabled.

## What We Changed

- Reworked the A/B denominator so bucket A and bucket B are compared on eligible test impressions, not later-stage funnel events.
- Fixed the product/cart/checkout display issue where product views and add-to-cart could appear identical because later funnel stages were being clamped incorrectly.
- Added hourly funnel rollups so dashboard ranges like 6h, 24h, 14d, and 30d can load from summarized data instead of scanning raw `escape_events`.
- Added a cron refresh path that refreshes the last 48 hours of hourly funnel rollups during retention maintenance.
- Backfilled recent hourly rollups after the RPC timeout issue.
- Added and tightened indexes for high-volume queries:
  - merchant/time/event/bucket funnel reads
  - purchase attribution reads
  - admin brand performance reads
- Short-circuited noisy `product_viewed` ingestion server-side when we do not need to persist it, reducing Supabase round trips.
- Added retention cleanup for raw event bloat and reduced unnecessary storage pressure from old telemetry.
- Identified `fbclid` and raw user-agent storage as low-value bloat. Approximate storage impact at the time of audit was about 296 MB in `escape_events`, with `fbclid` especially wasteful because it had payload storage plus an index with little attribution value.

## What Works

- Dashboard funnel queries are fast again after moving `eh_test_funnel` onto hourly rollups.
- The corrected denominator makes A/B split reads much more believable for merchants like COVE and SquidHaus.
- COVE’s 24h rollup query returned quickly after the hourly rollup fix and showed non-zero A/B data again.
- Impersonation now has better guardrails in the dashboard layout so the active merchant and impersonation cookie should stay consistent.
- The admin performance dashboard has enough structure to compare merchants, but it should continue to use rollups instead of raw table scans.
- The Porsche/incremental revenue card now uses lift math instead of gross projected revenue:
  - Incremental: `(RPV A - RPV B) * A visitors`
  - Rollout: `(RPV A - RPV B) * all eligible visitors`

## What Does Not Work Yet / Known Risks

- Full repo lint still fails on unrelated older React lint issues in admin, preview, and some client components. Touched dashboard files pass lint.
- Raw `escape_events` is still large and will keep growing quickly unless retention and payload slimming stay aggressive.
- `fbclid` is not proving useful enough to justify long retention or indexing.
- Raw user-agent is useful for debugging, but expensive to keep forever. Parsed fields plus short raw retention would be better.
- Once a merchant moves to 100% escape, there is no live randomized holdout unless we keep a small control group or use a historical baseline model.
- Attribution can still miss purchases when Shopify checkout/domain/client identity breaks the event join. The unattributed purchase banner helps expose the gap but does not fully solve it.
- Product view tracking is useful analytically, but it is high-volume. It should be sampled, rolled up, or retained briefly instead of kept raw forever.

## Recommended Storage Optimizations

1. Drop or avoid the `fbclid` index unless a concrete attribution workflow starts using it.
2. Stop long-term raw `fbclid` retention. Keep it short-lived only if debugging paid-click joins.
3. Replace raw user-agent retention with parsed fields:
   - browser family
   - OS family
   - device class
   - in-app browser kind
4. Keep raw user-agent for a short debug window only, such as 3-7 days.
5. Keep raw product/cart/checkout events for short retention, then rely on hourly/daily rollups.
6. Keep purchase/order events longer than browse events because they are lower volume and revenue-critical.
7. Partitioning or monthly archive tables should be considered if raw event volume keeps climbing on the paid plan.

## Query Rules

- Dashboard A/B reads should use rollups or RPCs, not client-side aggregation over raw rows.
- Admin cross-brand views should use pre-aggregated tables or RPCs with explicit time windows.
- Any new dashboard metric must define its denominator before implementation.
- Any test metric should specify whether it is:
  - test-only traffic
  - all eligible in-app browser traffic
  - paid-only traffic
  - all merchant traffic
- Avoid PostgREST convenience joins until the foreign key relationship has been verified in schema.

## 100% Rollout Measurement

When a test concludes and a merchant moves from 50/50 to 100% escape, we lose a live randomized B bucket. The best measurement options are:

### Best: Keep A Small Holdout

Run 90/10 or 95/5 instead of true 100%.

- A = escape
- B = holdout/control
- Continue calculating live incremental revenue with `(RPV A - RPV B) * A visitors`
- Client-facing value can show both:
  - realized incremental revenue from A traffic
  - rollout upside if B traffic had escaped too

This is the cleanest way to keep proving lift over time.

### Good: Test-Locked Baseline

If the client insists on 100% escape, freeze the final test baseline:

- Store the winning test window
- Store B/control RPV, CVR, AOV, confidence, and source scope
- During 100% rollout, compare current escaped traffic against the locked B baseline
- Show it as “estimated incremental revenue vs test baseline,” not live A/B proof

Formula:

`estimated incremental revenue = (current escaped RPV - locked control RPV) * current eligible visitors`

This is screenshot-friendly but should be labeled as an estimate.

### Backup: Pre/Post Model

Compare post-rollout performance to prior same-day / same-source historical periods.

- Useful for ongoing reporting
- More vulnerable to seasonality, promo mix, creative changes, and traffic quality changes
- Should not be presented as clean causal proof

## Recommended Product Direction

- For merchants who are still testing, use live A/B as the primary value proof.
- For merchants who have graduated, default to a tiny holdout if they will tolerate it.
- If they require 100%, create a “Baseline locked” state in the dashboard and report estimated incremental revenue against that baseline.
- The client report should clearly label:
  - Live A/B lift
  - Estimated rollout lift
  - Gross tracked revenue
  - Attribution gap

## Next Improvements

- Add a `merchant_test_baselines` table to snapshot completed tests.
- Add a dashboard state for `Testing`, `Ready to graduate`, and `Rolled out`.
- Add a report card that explains whether the value number is live A/B or estimated from a locked baseline.
- Add retention jobs for raw UA and `fbclid`.
- Add a storage health card showing table size, index size, and top payload fields.
- Move high-volume non-revenue telemetry to rollup-first storage.
