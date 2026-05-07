# Installing EscapeHatch on G FUEL — barebones, ~10 minutes

This is the minimum-viable rollout that gets us **real CVR + revenue lift data** on G FUEL's IG-sourced traffic. Two pieces, both copy-paste, no Shopify app required.

## What you'll get after install

- Every IG-IAB visitor gets bucketed 50/50 (cookie `eh_b=a|b`, 30-day persistence). Bucket A = escape, Bucket B = control.
- Bucket A visitors auto-redirect to Safari/Chrome. Bucket B stays in the IAB.
- Every checkout completion fires the Shopify Customer Events pixel, which beacons the order to our backend. We join it back to the original impression by Shopify's `_shopify_y` visitor cookie to recover the bucket.
- Dashboard shows CVR (A vs B), lift %, p-value, revenue per session, and a sample-size progress bar.

## Step 1 — Sign up + grab merchant ID

1. Go to **escapehatch.app/login** (or whatever the deployed URL is).
2. Enter your email → check inbox → click magic link.
3. You land on `/dashboard`.
4. Click **Get install snippet**. Copy your merchant ID — you'll paste it in two places.

Your merchant ID looks like `7beaa60e-2b77-4ef2-a30c-d1d4edc28b04`.

## Step 2 — Install the storefront snippet

1. Shopify admin → **Online store** → **Themes** → on the live theme click **Actions → Edit code**.
2. **Snippets** → **Add a new snippet** → name it `escapehatch`.
3. Paste:

```liquid
<script src="https://escapehatch.app/s/{{ MERCHANT_ID }}.js" async></script>
```

(Replace `{{ MERCHANT_ID }}` with your real ID. The snippet URL is what's shown on the install page — copy that.)

4. Open **Layout → `theme.liquid`**. Find the `<head>` tag. As the **very first child** of `<head>`, add:

```liquid
{% render 'escapehatch' %}
```

5. **Save**.

The snippet is ~1.6 KB, fires synchronously, runs before any other script. It:

- Detects mobile + IG IAB (and other IABs for analytics)
- Sets `eh_b=a|b` cookie (50/50 random)
- Reads `_shopify_y` cookie (Shopify's visitor ID) for purchase attribution
- Beacons an `impression` event with bucket + visitor ID
- For bucket A in IG IAB: fires `instagram://extbrowser/?url=...` to redirect

Note: theme updates can wipe `theme.liquid` edits. The snippet file stays in `snippets/`, but the `{% render 'escapehatch' %}` line in `theme.liquid` may need re-adding after a theme upgrade.

## Step 3 — Install the Customer Events pixel

This is what actually attributes purchases to buckets.

1. Shopify admin → **Settings** → **Customer events**.
2. Click **Add custom pixel**.
3. Name it `EscapeHatch`.
4. **Permission**: set to **Not required** (so it fires for all visitors, not just consented ones — checkout completion data is necessary for the service).
5. Paste the JavaScript shown on `/dashboard/install` (Step 2 there). It looks like:

```js
analytics.subscribe("checkout_completed", function (event) {
  try {
    var d = (event && event.data) || {};
    var c = d.checkout || {};
    var price = c.totalPrice || {};
    var order = c.order || {};
    var body = JSON.stringify({
      m: "YOUR-MERCHANT-ID",
      sy: event.clientId || null,
      v: typeof price.amount === "number" ? price.amount : parseFloat(price.amount || "0"),
      cy: price.currencyCode || null,
      oid: (order.id != null ? String(order.id) : (c.token || c.checkoutToken || null)),
      ts: Date.now()
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        var bl = new Blob([body], { type: "application/json" });
        var ok = navigator.sendBeacon("https://escapehatch.app/api/track/purchase", bl);
        if (ok) return;
      } catch (e) {}
    }
    fetch("https://escapehatch.app/api/track/purchase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body,
      keepalive: true,
      mode: "cors"
    }).catch(function () {});
  } catch (e) {}
});
```

(The dashboard version has your actual merchant ID baked in.)

6. Click **Save** then **Connect**. The pixel status should flip to **Connected**.

Custom Pixels run in a sandboxed iframe — they can't read your storefront cookies, but they can subscribe to standard events and call `fetch()`. We get `event.clientId` (= `_shopify_y` value) which is what we use to join purchase → bucket.

## Step 4 — Verify

End-to-end test on a real device (your phone, not desktop emulation):

1. DM yourself a link to gfuel.com from another account on Instagram.
2. Tap the link from inside the IG app.
3. **Bucket A path**: page should reopen in Safari (iOS) or Chrome (Android) within ~1s. Add a product, complete a test checkout (use a 100% off code or whatever G FUEL uses internally).
4. **Bucket B path**: if you happen to bucket into B, the page stays in IG IAB. Still complete a checkout to test the pixel fires there too.

Then on `/dashboard`:

- **Overview** should show ≥1 impression, ≥1 escape attempt (if bucket A), and ≥1 purchase within 30s.
- **A/B comparison** table should have data in both rows.
- **Revenue lift** card should show CVR for whichever bucket(s) have purchases.

If purchases don't appear after 5 minutes:

- Shopify admin → Customer events → EscapeHatch → check status is "Connected" and the events log shows recent fires.
- Open browser devtools on the thank-you page → Network tab → filter for `track/purchase` → check the request fired and got 200.
- If `joined: false, reason: "no_impression"` in the response, the visitor's `_shopify_y` doesn't match a recent impression — most common cause: snippet wasn't installed yet when they first landed.

## What G FUEL volume buys us

For a 30% MDE at 95% confidence and 80% power, baseline CVR ~2-3%, you need around **3,000-8,000 impressions per bucket**. G FUEL's IG-sourced volume should hit this in days, not weeks. Smaller MDEs (e.g., 10%) need ~10x more sessions; we recommend leaving the test running 2-4 weeks regardless to smooth out weekday/weekend effects.

The dashboard's sample-size progress bar updates as data comes in. **Don't peek and stop early** — that inflates false-positive rate. Pick a duration up front (suggestion: 14 days), let it run, then read the result.

## What this rollout doesn't do (yet)

- Add-to-cart and product-view tracking — we only beacon `checkout_completed` for v1. Funnel-level analysis (ATC rate, checkout-start rate) is a Phase 2 add.
- Stratification by IAB kind, device, geography. v1 is "all IG-sourced sessions, single comparison." If we want IG-only stratified analysis later, we filter `iab_kind = 'instagram'` server-side.
- Bot/duplicate filtering. Current implementation trusts the snippet + pixel beacons. SRM check (chi-square on bucket counts) is an open Phase 2 task.
- Sequential testing / early stopping. v1 ships fixed-horizon. Stop at the duration you set, not when the dashboard goes green.

These are listed in `docs/AB_TESTING_PLAN.md` for later.

## Rollback

If something goes wrong in production:

1. **Disable A/B** via `/dashboard/settings` toggle. Everyone reverts to bucket A (escape) on next snippet fetch (~5min edge cache).
2. **Disable escape entirely**: Customer Events admin → EscapeHatch → **Disconnect** stops purchase tracking. Then in `theme.liquid`, comment out the `{% render 'escapehatch' %}` line and save. The snippet file can stay in `snippets/` for re-enable.
