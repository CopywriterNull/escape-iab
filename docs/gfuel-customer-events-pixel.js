// EscapeHatch — Shopify Customer Events pixel for G FUEL
// Merchant: 8b6e80c0-88fd-4c9e-acab-39e21e6d7154
//
// Install: Shopify admin → Settings → Customer events → click EscapeHatch
// (replace existing code) → Save → Connect.
// ─────────────────────────────────────────────────────────────────

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
      "m=" + encodeURIComponent("8b6e80c0-88fd-4c9e-acab-39e21e6d7154") +
      "&sy=" + encodeURIComponent(event.clientId || "") +
      "&v=" + encodeURIComponent(amount || "") +
      "&cy=" + encodeURIComponent(price.currencyCode || "") +
      "&oid=" + encodeURIComponent(oid) +
      "&ts=" + Date.now();
    fetch("https://escape-iab.vercel.app/api/track/purchase?" + qs, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
});
