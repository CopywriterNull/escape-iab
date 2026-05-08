// EscapeHatch — Shopify Customer Events pixel for G FUEL
// Merchant: 8b6e80c0-88fd-4c9e-acab-39e21e6d7154
//
// Install: Shopify admin → Settings → Customer events → click EscapeHatch
// (replace existing code) → Save → Connect.
// Permission: Not required.
// ─────────────────────────────────────────────────────────────────

var EH_M = "8b6e80c0-88fd-4c9e-acab-39e21e6d7154";
var EH_BASE = "https://escape-iab.vercel.app/api/track/funnel";

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

analytics.subscribe("product_viewed", function (event) {
  try {
    var d = (event && event.data) || {};
    var pv = d.productVariant || {};
    var p = pv.product || {};
    var price = pv.price || {};
    var amount = 0;
    if (typeof price.amount === "number") amount = price.amount;
    else if (price.amount) amount = parseFloat(price.amount);
    var pid = "";
    if (p && p.id != null) pid = String(p.id);
    ehSend("product_viewed", {
      sy: ehSy(event),
      sid: ehSid(event),
      v: amount || "",
      cy: price.currencyCode || "",
      pid: pid
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
});
