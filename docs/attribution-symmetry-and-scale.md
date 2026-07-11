# Attribution symmetry (server-side / CAPI) + data-scale spec

_Written 2026-07-11. Grounded in live prod numbers (Supabase `Escape IAB`)._

## TL;DR

1. **You've already built most of server-side symmetric attribution.** The order
   webhook joins purchases to buckets server-to-server via `cart_attributions`
   (cart_token) → `eh_sid` → `fbclid`, and the snippet already writes `eh_sid`
   into Shopify cart attributes. This is the right architecture.
2. **The `cart_token` path is effectively dead** (0.1% coverage on purchases —
   Shopify no longer populates `order.cart_token` in modern/extensibility
   checkouts). Attribution actually rides on **`eh_sid`: 88% (bucket A) / 93%
   (bucket B)** — already reasonably symmetric.
3. **The real symmetry gaps** are (a) `eh_bucket` is *not* written to cart
   attributes, so bucket resolution still needs a raw-impression lookup, and
   (b) returning escaped shoppers who buy later with no `eh_sid` on the landing
   URL fall to `in_test=false` and get excluded — undercounting escape.
4. **Attribution work adds ~0 data to Supabase.** It rides the purchase path
   (~1.2% of events) which already exists; cart attributes live in Shopify;
   CAPI goes to Meta. The thing eating storage is the **impression firehose**,
   which is a *separate* scaling problem.

---

## 1. Current state (measured)

`escape_events` event mix, one high-volume merchant (COVE), 2 days:

| event_type       | rows/2d | share |
|------------------|--------:|------:|
| impression       | 165,295 | 31%   |
| product_viewed   | 163,566 | 31%   |
| escape_attempt   |  79,313 | 15%   |
| iab_detected     |  68,568 | 13%   |
| add_to_cart      |  33,733 |  6%   |
| checkout_started |   8,761 |  2%   |
| **purchase**     |   6,501 | **1.2%** |
| escape_skipped   |   4,207 |  1%   |

→ **~90% of volume is impression / product_viewed / escape_attempt / iab_detected.**
Purchases — the only rows attribution touches — are ~1.2%.

Attribution-key coverage on in-test purchases (all merchants, 14d):

| bucket | purchases | cart_token | eh_sid | fbclid |
|--------|----------:|-----------:|-------:|-------:|
| A (escape)  | 35,624 | 0.1% | **88.4%** | 0.0% |
| B (control) |    158 | 1.3% | **93.0%** | 0.6% |

(The 35,624 vs 158 gap is because most volume is on 100%-escape merchants where
bucket B ≈ 0, not an attribution defect.) The takeaway: **cart_token is dead,
eh_sid carries everything, and its coverage is symmetric across buckets.**

What's already built:
- `src/lib/snippet.ts` (~L423): `fetch("/cart/update.json", {attributes:{eh_sid}})`
  + captures `cart_token`.
- `src/app/api/track/route.ts` (~L128): upserts `cart_attributions`
  (merchant, cart_token, bucket, in_test, iab_kind, eh_sid, shopify_client_id)
  on `cart_check`.
- `src/app/api/webhooks/shopify/orders/route.ts`: multi-key join
  (cart_token → cart_attributions → escape_events; then eh_sid; then fbclid),
  server-to-server, HMAC-verified, dedup on (merchant, order_id).

---

## 2. Close the residual asymmetry (small, high-leverage)

### 2a. Write `eh_bucket` (and `eh_intest`) into cart attributes
Today only `eh_sid` is written to the cart; the webhook re-derives bucket by
looking up the impression row for that `eh_sid`. Add the bucket itself:

```js
fetch("/cart/update.json", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ attributes: { eh_sid: sid, eh_bucket: bucket, eh_intest: inTest ? "1" : "0" } }),
  credentials: "same-origin",
});
```

Then in the webhook, prefer the cart-attribute bucket before any DB lookup:

```
const attrBucket = findKey(order, "eh_bucket", 8);   // "a" | "b"
const attrInTest = findKey(order, "eh_intest", 2);   // "1" | "0"
if (attrBucket) { imp = { bucket: attrBucket, iab_kind: null }; joinMethod = "cart_attr_bucket"; }
```

Why it matters:
- **Self-contained attribution** — no impression lookup, so it can't fail
  because the impression aged out or the join query timed out.
- **Decouples attribution from raw-event retention** → you can TTL/drop raw
  impressions aggressively (see §4) without breaking joins. This is the hinge
  that lets the scale fixes happen safely.
- Symmetric by construction: the bucket travels with the order for A and B alike.

Cost: **0 new Supabase rows** (client → Shopify), a few bytes on the order payload.

### 2b. Measure join rate by bucket (instrument before claiming symmetry)
Add a lightweight counter: for A/B-enabled merchants during their test window,
track `attributed_purchases / total_orders` per bucket. Symmetry is a *number*,
not a vibe. If A and B join at materially different rates, that bias is exactly
what inflates/deflates RPV. (The webhook already returns `joined` + `method`;
roll those into a daily `attribution_health` rollup.)

### 2c. Returning-shopper gap (the honest hard part)
Escaped users who return days later in Safari and buy have no `eh_sid` on that
session's landing URL → `in_test=false` → excluded from the in-test comparison.
This **undercounts escape** (its retention edge). Options:
- Persist `eh_sid` in Safari `localStorage` and re-stamp cart attributes on any
  later visit (already partially done — verify it re-writes on return sessions).
- Accept it and report retention/halo separately (as today), but *label* the
  in-test number as "excludes downstream returns."

### 2d. Meta CAPI (fixes merchant ROAS perception, not your A/B)
Separate axis. iOS IG strips `fbclid` on the escape handoff, so Meta under-sees
escaped conversions → merchant's Ads Manager shows escape with worse ROAS.
- You already recover the click id as `eh_fbclid` and restore `fbclid`
  client-side (commit 1892a98). Complement it server-side: at the order webhook,
  push `fbc`/`fbp` + hashed PII into the merchant's **Shopify native Meta channel
  CAPI** (feed the recovered `fbc` into the cart/datalayer so the native channel
  credits it), or send your own CAPI `Purchase` with a shared **`event_id`** for
  dedup.
- **Must dedupe** (`event_id`) or conversions double-count. Hash PII. Respect
  consent. CAPI improves match rate, doesn't make it perfect (ATT still caps it).
- Storage cost: events go to Meta. If you log sends for dedup/debug, ~1 small
  row/purchase (~1–2 MB/day across all merchants). Negligible and optional.

---

## 3. "How much MORE data does this add?" — essentially none

| Change | New Supabase rows | New storage |
|--------|-------------------|-------------|
| `eh_bucket` in cart attributes | 0 (client → Shopify) | ~bytes on order payload |
| Webhook prefers cart-attr bucket | 0 (already inserts 1 purchase/order) | 0 |
| `cart_attributions` (already live) | already ~1 row/cart, not per event | already counted |
| Attribution-health rollup (2b) | ~1 row/merchant/day | KB/day |
| CAPI sends (2d) | 0 (→ Meta), or ~1 log row/purchase if you keep one | ~1–2 MB/day, optional |

**Attribution symmetry is a join-quality upgrade, not a volume upgrade.** It
rides the purchase path (1.2% of events) which already exists.

---

## 4. The actual scaling problem: the impression firehose

This is what's causing your lag, and it's independent of attribution.

**Current footprint (2026-07-11):**
- `escape_events`: **23.5M rows, 42 GB** (22 GB heap + **20 GB indexes**).
- Growth: ~**+16 GB in 3 weeks (~5 GB/week)**, unbounded — nothing drops old rows.
- Row width: ~0.94 KB heap/row → fat rows (raw `url`, `user_agent`, `referrer`).
- `cart_attributions`: 4.6M rows / 2.7 GB (1 row/cart — fine).
- Rollups: KB-scale (fine).
- Per brand at ~100k visitors/mo ≈ 0.6–1.2M events/mo ≈ **1–2 GB/mo** (matches
  your "a couple GB per brand").

**Why ingestion lags:** every insert into a 42 GB table updates ~13 indexes
(20 GB of them). Write amplification on the hot `/api/track` path is the bottleneck,
plus the rollup cron doing `count(distinct)` over huge windows.

**Levers, in priority order (impact × effort):**

1. **TTL raw events (biggest immediate win).** Attribution join window is 30d
   (`JOIN_WINDOW_DAYS`); rollups hold the aggregates forever. So raw events older
   than ~35d aren't needed. Dropping them turns *unbounded growth* into a
   *steady-state cap*. **Prerequisite: 2a** (bucket in cart attributes) so old
   impressions aren't needed for joins.
2. **Partition `escape_events` by month** (already investigated, not executed —
   see `SUPABASE.md`). Makes TTL a cheap `DROP PARTITION` (no vacuum storm),
   prunes time-ranged queries, shrinks per-partition indexes.
3. **Index diet.** 20 GB of indexes ≈ the heap. Audit which are actually used by
   the rollup refresh + attribution join; drop the rest. Directly reduces the
   write amplification causing the lag.
4. **Trim row width.** Stop storing raw `user_agent`/full `url` on every
   impression (parse to small fields or drop). ~2× smaller heap.
5. **Don't store the 90%-volume low-value events raw.** `product_viewed` +
   `iab_detected` + much of `impression` exist only to feed rollups. Increment
   the rollup at ingest and **skip the raw insert** (or sample 1-in-N). Could cut
   ingest volume 50–90% — the highest-leverage structural change.
6. **Async ingestion.** Buffer `/api/track` writes (edge → queue → batch insert)
   so the hot path returns instantly and Postgres isn't in the request critical
   path. Removes user-visible lag even before the table shrinks.
7. **Long-term: offload the firehose** to a columnar/append store (Tinybird /
   ClickHouse / BigQuery) for analytics; keep Postgres for attribution keys
   (`cart_attributions`, purchases) + rollups only. This is the durable answer
   at multi-brand scale.

---

## 5. Recommended sequence

1. **2a** — write `eh_bucket`/`eh_intest` to cart attributes + prefer them in the
   webhook. (Small, unlocks safe TTL, improves symmetry.)
2. **4.1 + 4.2** — monthly partition + 35-day TTL on raw events. (Stops the bleed.)
3. **4.3 + 4.4** — index diet + row-width trim. (Fixes ingestion lag, halves heap.)
4. **2b** — attribution-health rollup (join rate by bucket) to *prove* symmetry.
5. **4.5** — stop storing low-value raw events; rollup-at-ingest. (Structural.)
6. **2d** — CAPI, once first-party symmetry is trusted, to fix merchant ROAS.
7. **4.6 / 4.7** — async ingestion + firehose offload as volume grows.

Steps 1–3 are the ones that both **make the lift numbers defensible** and
**stop the data lag** — do those first.
