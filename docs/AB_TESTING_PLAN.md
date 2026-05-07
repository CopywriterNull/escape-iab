# A/B Testing Plan — measuring real revenue lift, not just escape rate

The dashboard we shipped today measures **our funnel** (impressions → escapes → fallback). That's necessary but not sufficient. Merchants don't pay $29/mo to know how many escapes fired — they pay to know whether escaping made them more money.

This doc plans the v2: measuring downstream conversion (CVR, ATC, checkout-started, purchase) by bucket, computing lift with statistical confidence, and shipping a defensible "this made you $X more" number on the dashboard.

---

## 1. What we're trying to measure

The honest unit of value for a merchant is **revenue per IG-sourced session**. That decomposes into a funnel:

```
Impression (IG-sourced session lands)
   ↓ atc_rate
Add to cart
   ↓ checkout_start_rate
Checkout started
   ↓ purchase_rate
Purchase completed → revenue
```

A bucket-A visitor is escaped to Safari at impression. A bucket-B visitor stays in the IAB. We need to compare:

| Metric | A (escape) | B (control) | Lift |
| --- | --- | --- | --- |
| Sessions | 12,481 | 12,506 | — |
| ATC rate | 9.4% | 4.1% | +129% |
| Checkout-started rate | 6.2% | 1.8% | +244% |
| Purchase rate (CVR) | 2.41% | 0.83% | +190% |
| Avg order value | $48.20 | $46.10 | +4.6% |
| Revenue per session | $1.16 | $0.38 | +205% |

That last row is the headline. Everything else is the supporting funnel.

---

## 2. Events we need to capture

Today we have:

- `impression` — set on every page load, with bucket
- `iab_detected`, `escape_attempt`, `escape_skipped`, `fallback_shown`, `fallback_clicked` — internal funnel

Adding for v2:

- `product_viewed` — visitor hit a product page
- `add_to_cart` — visitor added a SKU to cart
- `checkout_started` — visitor reached the checkout
- `purchase` — order completed (with `value`, `currency`, `order_id`)

For each: bucket, session/visitor ID, timestamp, and (for purchase) order value.

---

## 3. The hard problem: attribution

Our snippet sets `eh_b=a|b` as a first-party cookie when the visitor lands. That cookie identifies their bucket for 30 days. But we need to attribute their **eventual purchase** back to that bucket. Three integration paths, in order of preference for Shopify merchants:

### 3a. Shopify App Embed (theme extension) — the primary path

Our existing `<script src="...">` install runs in the main page DOM. From there we can:

- Read `eh_b` cookie on every page → know the bucket
- Hook into Shopify's standard event surface: `window.Shopify`, `ShopifyAnalytics.meta`, page URL patterns (`/products/*`, `/cart`, `/checkouts/*`, `/thank_you`)
- Capture `_shopify_y` (Shopify's visitor ID cookie, 1-year persistence) and beacon it with every event
- Detect ATC via XHR/fetch monitoring on `/cart/add.js` and `/cart/change.js`
- Detect purchase via URL match on `/orders/*` or thank-you page DOM

**Pros:** full visibility, reads our cookie, no Shopify app install dance.
**Cons:** thank-you page detection via URL/DOM is fragile if the merchant customized templates.

### 3b. Shopify Web Pixel — the rigorous path for Pro tier

Shopify ships a [Web Pixels API](https://shopify.dev/docs/api/web-pixels-api) with a [`standard-events` library](https://shopify.dev/docs/api/web-pixels-api/standard-events): `page_viewed`, `product_viewed`, `product_added_to_cart`, `cart_viewed`, `checkout_started`, `checkout_completed`, etc. The pixel runs in a **strict sandbox** (Web Worker for App Pixels, sandboxed iframe for Custom Pixels) with no DOM access — but it does get every event with structured payloads, including the order on `checkout_completed`.

The catch: pixel sandbox **can't read our `eh_b` cookie**. But it can read `event.clientId` (= Shopify's `_shopify_y` cookie). So:

1. App Embed (3a) records `_shopify_y` alongside `eh_b` on every impression.
2. Web Pixel (3b) subscribes to `checkout_completed`, beacons `{ clientId, value, currency, orderId }` to a new endpoint `/api/track/purchase`.
3. Backend joins on `clientId` → looks up the original bucket → attributes the purchase.

This is the **most reliable path** for Shopify because Web Pixels run server-side after the order is confirmed; URL-based detection on the thank-you page misses upsells, post-purchase pages, and themes where the URL isn't `/thank_you`.

**Pros:** authoritative purchase data; survives template changes.
**Cons:** requires merchant to install our Shopify app (more friction). Right approach: ship App Embed first, layer Web Pixel as a Pro-tier upgrade.

### 3c. Manual `EH.track()` API — the universal escape hatch

Expose `window.EH.track(eventName, props)` from the snippet. Merchants on non-Shopify storefronts (custom, BigCommerce, WooCommerce, Webflow) call it from their thank-you page:

```html
<script>
  window.EH && EH.track('purchase', { value: 48.00, currency: 'USD', order_id: '#1234' });
</script>
```

The bucket is read from the `eh_b` cookie automatically.

**Pros:** works everywhere, full control.
**Cons:** requires merchant to add a one-liner; if they forget on the thank-you page, no purchase data.

---

## 4. Dedup, bots, and bucket integrity

Things that will look like CVR lift but aren't:

- **Bot traffic** that fires impressions but never converts inflates the denominator. Mitigation: filter UAs with `bot|crawler|spider|headless` from impression counts. Already cheap.
- **Sample ratio mismatch (SRM)** — if A:B isn't ~50:50 something is wrong (e.g., bots all bucket the same, or one bucket's beacons fail). Run a chi-square goodness-of-fit on the bucket counts daily. SRM > 0.001 p-value = halt and investigate.
- **Duplicate purchases** — same order beaconed multiple times if merchant's thank-you page reloads. Dedup on `(merchant_id, order_id)` unique constraint.
- **Returning customer carryover** — same `eh_b` cookie persists 30 days, so a returning customer stays in their bucket. This is correct behavior (consistent UX), but it means small stores will see less variance per visitor than a fresh-randomization model.
- **Cookie loss on iOS** — Safari intelligent-tracking-prevention can clear cookies after 7 days of no first-party activity. Customers who shop monthly may bucket A on visit 1, lose cookie, get bucket B on visit 2. Acceptable noise; same for control.

---

## 5. Statistical methodology

### 5a. Sample size and MDE

Standard practice in ecom A/B testing:

- **Confidence:** 95% (α = 0.05)
- **Power:** 80% (β = 0.20)
- **Minimum Detectable Effect (MDE):** 10–20% relative change is reasonable for ecom CVR work; 5% if you have huge volume

For a baseline CVR of 3% and a 20% MDE at 95% confidence / 80% power, you need **~8,500 visitors per bucket** = 17,000 total. ([abtasty calculator](https://www.abtasty.com/sample-size-calculator/), [optimizely](https://www.optimizely.com/sample-size-calculator/).)

Most SMB Shopify stores don't have 17,000 IG-sourced sessions in a 2-week test window. Two implications:

1. **Power calculator widget** on the dashboard. Show "you have 1,240 in A, 1,210 in B. Need ~7,000 more per bucket to detect a 20% lift at 95% confidence." Give merchants a realistic ETA based on their daily IG volume.
2. **Default MDE = 30%** for low-volume stores. The reality is the lift from IAB escape is often big (we've seen vendor reports of 28-40% checkout lift), so smaller MDEs are wasted effort. Tighten only after the store has steady-state data.

### 5b. Significance test

Two-proportion z-test for binary outcomes (CVR, ATC rate):

```
p_pool = (x_a + x_b) / (n_a + n_b)
SE = sqrt(p_pool * (1 - p_pool) * (1/n_a + 1/n_b))
z = (p_a - p_b) / SE
p-value = 2 * (1 - Φ(|z|))
```

For revenue per session (continuous, skewed): use Welch's t-test on log(1 + revenue) or bootstrap the difference in means. Welch's is fine for v1.

Confidence interval for relative lift `(p_a - p_b) / p_b`: delta method or bootstrap. Bootstrap is more honest for the kind of distributions we'll see.

### 5c. Don't peek

Sequential / repeated significance testing (looking at the dashboard daily and stopping when it goes green) inflates false-positive rate. Two clean approaches:

1. **Fixed-horizon test:** pick a duration (2-4 weeks) up front, only declare a winner at the end. Easiest to teach merchants.
2. **Sequential test with α-spending:** mSPRT, group-sequential, etc. Statsig / Optimizely / GrowthBook do this. Complexity not worth it for v1.

For v1, ship the fixed-horizon UX. Hide the "winner" verdict until the test reaches its sample-size goal. After that, show it boldly.

### 5d. Stratification

If we have enough volume, stratify by:

- **IAB kind** (Instagram traffic vs FB IAB vs TikTok IAB — escape only fires for IG, so the others are noise contaminating bucket B if not filtered)
- **Device** (iOS vs Android — IAB behavior differs)
- **Geography** (network speed, payment method availability)

For v1: just filter the analysis to **`iab_kind = 'instagram'`** for the primary CVR comparison. Otherwise bucket B is polluted with TikTok IAB traffic where escape never fires anyway, masking the IG-specific lift.

---

## 6. Schema additions

Adding to `escape_events` (already has merchant_id, event_type, bucket, iab_kind, url, ts):

```sql
alter table public.escape_events add column if not exists shopify_client_id text;  -- _shopify_y
alter table public.escape_events add column if not exists value_cents int;          -- order amount in minor units
alter table public.escape_events add column if not exists currency text;            -- ISO 4217
alter table public.escape_events add column if not exists order_id text;
```

Expand event_type CHECK to include: `product_viewed`, `add_to_cart`, `checkout_started`, `purchase`.

New table for fast funnel queries:

```sql
create table if not exists public.funnel_rollups (
  merchant_id uuid not null,
  day date not null,
  bucket text not null,
  iab_kind text,                    -- nullable: aggregate across kinds when null
  impressions int not null default 0,
  product_views int not null default 0,
  atcs int not null default 0,
  checkout_starts int not null default 0,
  purchases int not null default 0,
  revenue_cents bigint not null default 0,
  primary key (merchant_id, day, bucket, iab_kind)
);
```

Unique constraint on purchase dedup:

```sql
create unique index purchase_dedup on public.escape_events (merchant_id, order_id)
  where event_type = 'purchase' and order_id is not null;
```

---

## 7. Dashboard additions

New section on `/dashboard`: **Revenue lift**.

- Funnel chart (5 horizontal bars per bucket: impressions → product_view → ATC → checkout_started → purchase).
- Stat tiles: CVR(A), CVR(B), Lift %, p-value, "stat sig: yes/no/not enough data".
- Sample size progress bar: "1,240 / 8,500 needed for 95% confidence at 20% MDE".
- Revenue tile: "$1,247 attributed to escape so far. At current rate, $4,900/mo recovered."

New page `/dashboard/test` for the active A/B test:

- Test config: MDE, confidence, expected daily volume, projected end date
- Daily counts table by bucket
- IAB-kind stratified breakdown (only IG, only TikTok, etc.)
- "Stop test" button (sets `ab_enabled=false` and bumps everyone to bucket A going forward)

---

## 8. Phased rollout

### Phase 1 — App Embed funnel (this is the next sprint)

- Snippet hooks: detect product page (`/products/*`), cart-add via fetch interception on `/cart/add.js`, checkout reach via URL match on `/checkouts/*`, purchase via DOM signal on `/thank_you` or order URL pattern.
- Beacon `product_viewed`, `add_to_cart`, `checkout_started`, `purchase` events with bucket + `_shopify_y`.
- Backend: extend rollup RPC, add funnel_rollups table.
- Dashboard: add funnel chart + revenue lift stat tile.

### Phase 2 — Web Pixel for purchase truth

- Build Shopify app extension with Web Pixel that subscribes to `checkout_completed`.
- Backend endpoint `/api/track/purchase` accepts pixel beacons keyed on `_shopify_y`.
- Dedup against App Embed's purchase events (Pixel wins; it's authoritative).
- Sell as the Pro-tier upgrade ("authoritative purchase tracking via Shopify Web Pixel").

### Phase 3 — Statistical significance

- Server-side computation of two-proportion z-test, p-value, confidence interval.
- Sample size calculator widget.
- "Test status" badge (green / amber / red) per bucket comparison.
- Bootstrap CI for revenue per session.

### Phase 4 — Manual `EH.track()` API for non-Shopify

- Expose `window.EH = { track: function(name, props) {...} }`.
- Document on the install page with a thank-you-page snippet for BigCommerce / Woo / Webflow / custom.

### Phase 5 — Stratified analysis

- Per-IAB-kind breakdown
- Per-device breakdown
- "Significance achieved on Instagram traffic only" badge

---

## 9. The honest pitch for the dashboard

When a merchant lands on the dashboard, three numbers should be visible above the fold:

1. **Sessions escaped this month** — proof we're doing the thing. "12,481 IG sessions reopened in Safari."
2. **Estimated lift** — "Escape sessions converted at 2.41%, control at 0.83%. +190% lift, statistically significant (p < 0.01)."
3. **Estimated revenue recovered** — "At your AOV of $48, that's an estimated $4,900 / month you'd be missing."

Number 2 and 3 are the reason the merchant pays. Number 1 is the proof of work.

Until we ship this, the dashboard tells a partial story. The current escape-rate / fallback-shown view is a fine v1 — it shows the snippet is alive and bucketing — but it doesn't justify $29/mo on its own.

---

## 10. Honest caveats to put in the docs

- "Lift will vary widely by store. We've seen 30-200% CVR lift on IG-sourced traffic in vendor case studies, but your numbers will depend on your AOV, your customer base, and how dependent your checkout is on Apple Pay / Shop Pay."
- "Most stores will need 2-4 weeks of data before lift estimates stabilize. Treat early numbers as directional."
- "We measure CVR on IG-sourced traffic only by default — non-IG IAB sessions are excluded from the primary analysis because we don't escape them."

---

## Sources

- [Shopify Web Pixels API — Standard Events](https://shopify.dev/docs/api/web-pixels-api/standard-events)
- [Shopify — checkout_completed event](https://shopify.dev/docs/api/web-pixels-api/standard-events/checkout_completed)
- [Shopify — Pixels and customer events](https://help.shopify.com/en/manual/promoting-marketing/pixels)
- [Shopify — About web pixels (App Pixels vs Custom)](https://shopify.dev/docs/apps/build/marketing-analytics/pixels)
- [AB Tasty sample size calculator](https://www.abtasty.com/sample-size-calculator/)
- [Optimizely sample size calculator](https://www.optimizely.com/sample-size-calculator/)
- [GuessTheTest — calculating sample size and test duration](https://guessthetest.com/calculating-sample-size-in-a-b-testing-everything-you-need-to-know/)
- [NN/g — A/B Testing 101](https://www.nngroup.com/articles/ab-testing/)
