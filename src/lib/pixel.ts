// Generates the JavaScript merchants paste into Shopify admin →
// Settings → Customer events → Add custom pixel.
//
// Shopify Custom Pixels run in a heavily sandboxed Web Worker. POST + body +
// content-type negotiation is fragile in there — many CSP / sandbox configs
// silently drop the request. GET with query params is the most permissive form
// and works everywhere a pixel can call out at all. Backend accepts both GET
// and POST on /api/track/purchase.

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
    var amount = typeof price.amount === "number"
      ? price.amount
      : parseFloat(price.amount || "0");
    var oid = (order && order.id != null)
      ? String(order.id)
      : (c.token || c.checkoutToken || "");
    var qs =
      "m=" + encodeURIComponent(${merchantId}) +
      "&sy=" + encodeURIComponent(event.clientId || "") +
      "&v=" + encodeURIComponent(amount || "") +
      "&cy=" + encodeURIComponent(price.currencyCode || "") +
      "&oid=" + encodeURIComponent(oid) +
      "&ts=" + Date.now();
    fetch(${ingestUrl} + "?" + qs, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
});`;
}
