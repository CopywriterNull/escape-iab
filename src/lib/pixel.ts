// Generates the Shopify Custom Pixel JS that captures the conversion
// funnel: product_added_to_cart, checkout_started, checkout_completed.
// Each event is sent to /api/track/funnel as a GET with event type +
// Shopify clientId + (where applicable) value/currency/order. Backend
// joins each event back to the original impression by clientId to
// recover the bucket assignment.
//
// product_viewed was previously subscribed too but was dropped: it fires
// once per product page view (multiplied across browsing) without adding
// signal beyond add_to_cart for the funnel chart. The cost (~50% of
// pixel-side function invocations) wasn't justifying the use.

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

// Pull eh_sid from cart attributes — set by snippet via /cart/update.json.
// Survives the Shopify checkout cookie-jar break that stops sy from joining.
// Shopify exposes attributes on cart.attributes (array of {key,value}) and
// checkout.attributes; we check both depending on the event surface.
function ehSid(event) {
  try {
    var d = (event && event.data) || {};
    var sources = [d.cart && d.cart.attributes, d.checkout && d.checkout.attributes];
    for (var i = 0; i < sources.length; i++) {
      var attrs = sources[i];
      if (!attrs) continue;
      if (Array.isArray(attrs)) {
        for (var j = 0; j < attrs.length; j++) {
          if (attrs[j] && attrs[j].key === "eh_sid" && attrs[j].value) return attrs[j].value;
        }
      } else if (typeof attrs === "object" && attrs.eh_sid) {
        return attrs.eh_sid;
      }
    }
  } catch (e) {}
  return "";
}

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
      sid: ehSid(event),
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
      sid: ehSid(event),
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
      sid: ehSid(event),
      v: amount || "",
      cy: price.currencyCode || "",
      oid: oid
    });
  } catch (e) {}
});`;
}
