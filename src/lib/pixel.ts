// Generates the Shopify Custom Pixel JS that captures the full conversion
// funnel: product_viewed, product_added_to_cart, checkout_started,
// checkout_completed. Each event is sent to /api/track/funnel as a GET with
// event type + Shopify clientId + (where applicable) value/currency/order.
// Backend joins each event back to the original impression by clientId to
// recover the bucket assignment.

type PixelOpts = {
  merchantId: string;
  ingestUrl: string; // absolute URL to /api/track/funnel
};

export function buildShopifyPixel(opts: PixelOpts): string {
  const merchantId = JSON.stringify(opts.merchantId);
  const ingestUrl = JSON.stringify(opts.ingestUrl);

  return `// EscapeHatch — Shopify Customer Events pixel
// Paste in Shopify admin → Settings → Customer events → Add custom pixel.
// Set Permission to "Not required". Save → Connect.
var EH_M = ${merchantId};
var EH_BASE = ${ingestUrl};

function ehSend(et, params) {
  try {
    var qs = "m=" + encodeURIComponent(EH_M) + "&e=" + encodeURIComponent(et);
    for (var k in params) {
      if (params[k] != null && params[k] !== "") {
        qs += "&" + k + "=" + encodeURIComponent(params[k]);
      }
    }
    qs += "&ts=" + Date.now();
    try {
      fetch(EH_BASE + "?" + qs, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
    try {
      if (typeof Image !== "undefined") {
        var img = new Image();
        img.src = EH_BASE + "?" + qs + "&_t=img";
      }
    } catch (e) {}
  } catch (e) {}
}

function ehSy(event) {
  if (event && event.clientId) return event.clientId;
  return "";
}

analytics.subscribe("product_viewed", function (event) {
  try {
    var d = (event && event.data) || {};
    var pv = d.productVariant || {};
    var p = pv.product || {};
    var price = pv.price || {};
    var amount = 0;
    if (typeof price.amount === "number") amount = price.amount;
    else if (price.amount) amount = parseFloat(price.amount);
    ehSend("product_viewed", {
      sy: ehSy(event),
      v: amount || "",
      cy: price.currencyCode || "",
      pid: p.id != null ? String(p.id) : ""
    });
  } catch (e) {}
});

analytics.subscribe("product_added_to_cart", function (event) {
  try {
    var d = (event && event.data) || {};
    var line = d.cartLine || {};
    var merch = line.merchandise || {};
    var price = merch.price || {};
    var amount = 0;
    if (typeof price.amount === "number") amount = price.amount;
    else if (price.amount) amount = parseFloat(price.amount);
    ehSend("add_to_cart", {
      sy: ehSy(event),
      v: amount || "",
      cy: price.currencyCode || ""
    });
  } catch (e) {}
});

analytics.subscribe("checkout_started", function (event) {
  try {
    var d = (event && event.data) || {};
    var c = d.checkout || {};
    var price = c.totalPrice || {};
    var amount = 0;
    if (typeof price.amount === "number") amount = price.amount;
    else if (price.amount) amount = parseFloat(price.amount);
    ehSend("checkout_started", {
      sy: ehSy(event),
      v: amount || "",
      cy: price.currencyCode || ""
    });
  } catch (e) {}
});

analytics.subscribe("checkout_completed", function (event) {
  try {
    var d = (event && event.data) || {};
    var c = d.checkout || {};
    var price = c.totalPrice || {};
    var order = c.order || {};
    var amount = 0;
    if (typeof price.amount === "number") amount = price.amount;
    else if (price.amount) amount = parseFloat(price.amount);
    var oid = "";
    if (order && order.id != null) oid = String(order.id);
    else if (c.token) oid = c.token;
    else if (c.checkoutToken) oid = c.checkoutToken;
    ehSend("purchase", {
      sy: ehSy(event),
      v: amount || "",
      cy: price.currencyCode || "",
      oid: oid
    });
  } catch (e) {}
});`;
}
