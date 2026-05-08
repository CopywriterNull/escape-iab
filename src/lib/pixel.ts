// Generates the JavaScript merchants paste into Shopify admin →
// Settings → Customer events → Add custom pixel.
//
// Runs in a sandboxed iframe. No DOM access, but it gets `analytics.subscribe`
// for standard events. We subscribe to `checkout_completed` and beacon
// the order details + Shopify visitor `clientId` to our /api/track/purchase
// endpoint. Backend joins on clientId to recover the bucket from the original
// impression.

type PixelOpts = {
  merchantId: string;
  ingestUrl: string; // absolute URL to /api/track/purchase
};

export function buildShopifyPixel(opts: PixelOpts): string {
  const merchantId = JSON.stringify(opts.merchantId);
  const ingestUrl = JSON.stringify(opts.ingestUrl);

  return `// EscapeHatch — Shopify Customer Events pixel
// Paste this in Shopify admin → Settings → Customer events → Add custom pixel.
// Set "Permission" to "Not required" so it fires for all visitors.
analytics.subscribe("checkout_completed", function (event) {
  try {
    var d = (event && event.data) || {};
    var c = d.checkout || {};
    var price = c.totalPrice || {};
    var order = c.order || {};
    var body = JSON.stringify({
      m: ${merchantId},
      sy: event.clientId || null,
      v: typeof price.amount === "number" ? price.amount : parseFloat(price.amount || "0"),
      cy: price.currencyCode || null,
      oid: (order.id != null ? String(order.id) : (c.token || c.checkoutToken || null)),
      ts: Date.now()
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        var bl = new Blob([body], { type: "text/plain;charset=UTF-8" });
        var ok = navigator.sendBeacon(${ingestUrl}, bl);
        if (ok) return;
      } catch (e) {}
    }
    fetch(${ingestUrl}, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: body,
      keepalive: true,
      mode: "cors",
      credentials: "omit"
    }).catch(function () {});
  } catch (e) {}
});`;
}
