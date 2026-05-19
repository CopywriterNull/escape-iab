"use client";

import { useState } from "react";

// ─── UA presets ─────────────────────────────────────────────────────
// Real strings sampled from production logs (truncated where length
// adds no diagnostic value). Each preset reflects what the snippet's
// UA regex actually sees in the wild.
const UA_PRESETS: { id: string; label: string; ua: string; group: string }[] = [
  {
    id: "ig-ios",
    label: "Instagram · iOS 17",
    group: "Meta",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 326.0.0.0.0",
  },
  {
    id: "ig-android",
    label: "Instagram · Android 14",
    group: "Meta",
    ua: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 326.0.0.0",
  },
  {
    id: "threads-ios",
    label: "Threads · iOS",
    group: "Meta",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 305.0.0.0",
  },
  {
    id: "fb-ios",
    label: "Facebook · iOS",
    group: "Meta",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/445.0.0.41.110;FBBV/567]",
  },
  {
    id: "fb-android",
    label: "Facebook · Android",
    group: "Meta",
    ua: "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/445.0.0.41.110]",
  },
  {
    id: "messenger-ios",
    label: "Messenger · iOS",
    group: "Meta",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/445.0.0.45.119]",
  },
  {
    id: "tiktok-ios",
    label: "TikTok · iOS",
    group: "Other IABs",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_28.0.0 JsSdk/2.0",
  },
  {
    id: "snapchat",
    label: "Snapchat · iOS",
    group: "Other IABs",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.85",
  },
  {
    id: "discord-ios",
    label: "Discord · iOS",
    group: "Other IABs",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Discord/220.0",
  },
  {
    id: "chrome-mobile",
    label: "Mobile Safari (negative control)",
    group: "Negative controls",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    id: "desktop",
    label: "Desktop Chrome (negative control)",
    group: "Negative controls",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
];

type Merchant = { id: string; name: string | null; domain: string | null };

type TraceEvent =
  | { type: "beacon"; via: "sendBeacon" | "fetch"; url: string; payload: Record<string, unknown> }
  | { type: "redirect"; url: string }
  | { type: "navigate"; url: string }
  | { type: "cookie_set"; name: string; value: string }
  | { type: "sessionstorage_set"; key: string; value: string }
  | { type: "warn"; message: string }
  | { type: "fatal"; message: string };

type TraceResult = {
  events: TraceEvent[];
  cookiesAfter: [string, string][];
  asyncFlag: boolean;
};

/** Server-side install verification: did we find the snippet tag in the
 *  target URL's real HTML, and is it deployed correctly (no async/defer,
 *  in <head>, pointing at the right merchant). */
type InstallCheck =
  | { ok: false; stage?: string; error: string; url?: string }
  | {
      ok: true;
      url: string;
      finalUrl: string;
      status: number;
      bytesRead: number;
      truncated: boolean;
      scannedRegion?: "head" | "head_fallback";
      expectedMerchantId: string;
      snippetFound: boolean;
      tag: string | null;
      src?: string | null;
      hasAsync: boolean;
      hasDefer: boolean;
      position: "head" | "body" | "unknown" | null;
      wrongMerchantTags: Array<{
        tag: string;
        src?: string;
        merchantId: string;
        hasAsync: boolean;
        hasDefer: boolean;
        position: "head" | "body" | "unknown";
      }>;
      anyEscapeHatchTag: boolean;
    };

function safeJsonParse(s: unknown): Record<string, unknown> {
  if (typeof s !== "string") return { _raw: String(s) };
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return { _raw: s };
  }
}

/** Run the production snippet body against a synthetic environment.
 *  Every read of navigator/location/document/etc and every write
 *  (fetch, sendBeacon, location.replace, cookie, sessionStorage)
 *  is captured into the trace. The snippet IIFE is wrapped in an
 *  outer function whose parameters shadow the relevant globals. */
function runTrace(
  snippetBody: string,
  opts: {
    ua: string;
    targetUrl: string;
    cookies: Record<string, string>;
    asyncTag: boolean;
  },
): TraceResult {
  const events: TraceEvent[] = [];
  const cookies = new Map(Object.entries(opts.cookies));
  let url: URL;
  try {
    url = new URL(opts.targetUrl);
  } catch {
    return {
      events: [{ type: "fatal", message: `Invalid target URL: ${opts.targetUrl}` }],
      cookiesAfter: [],
      asyncFlag: opts.asyncTag,
    };
  }

  const mockLocation = {
    get search() { return url.search; },
    get href() { return url.href; },
    get host() { return url.host; },
    get hostname() { return url.hostname; },
    get pathname() { return url.pathname; },
    get protocol() { return url.protocol; },
    get hash() { return url.hash; },
    replace(target: string) {
      events.push({ type: "redirect", url: target });
      throw new Error("__eh_redirect_thrown__");
    },
  } as unknown as Location;
  // Object property descriptor for `href` setter — snippet uses
  // `location.href = url` as a fallback if replace throws.
  Object.defineProperty(mockLocation, "href", {
    get() { return url.href; },
    set(v: string) { events.push({ type: "navigate", url: v }); },
  });

  const mockNavigator = {
    userAgent: opts.ua,
    sendBeacon(target: string, body?: BodyInit) {
      let payload: Record<string, unknown> = {};
      if (body instanceof Blob) {
        // Synchronously read blobs via fileReader? Not in browser sync.
        // The snippet builds Blob from a stringified JSON; we sniff text.
        try {
          // Best-effort: most browsers expose .text() async. Skip Blob
          // contents — the snippet path that uses fetch fallback yields
          // the JSON we want. We do however log that the beacon fired.
          payload = { _note: "sendBeacon Blob (sync read unavailable in browser)" };
        } catch {
          payload = {};
        }
      } else if (typeof body === "string") {
        payload = safeJsonParse(body);
      }
      events.push({ type: "beacon", via: "sendBeacon", url: target, payload });
      return true;
    },
    cookieEnabled: true,
  } as unknown as Navigator;

  const cookieGetter = () =>
    Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  const cookieSetter = (raw: string) => {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) return;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    cookies.set(k, v);
    events.push({ type: "cookie_set", name: k, value: v });
  };

  const mockDocument = {
    get cookie() { return cookieGetter(); },
    set cookie(v: string) { cookieSetter(v); },
    currentScript: {
      async: opts.asyncTag,
      defer: false,
      src: `https://getescapehatch.com/s/MERCHANT_ID.js?v=14`,
    },
    addEventListener() {},
    createElement() {
      return {
        addEventListener() {},
        setAttribute() {},
        appendChild() {},
        style: {},
        href: "",
        textContent: "",
        id: "",
      };
    },
    body: { appendChild() {} },
    documentElement: { appendChild() {} },
    readyState: "complete",
    hidden: false,
  } as unknown as Document;
  // `document.cookie` is a property — define it explicitly so the
  // snippet's set+get pattern actually round-trips through our jar.
  Object.defineProperty(mockDocument, "cookie", {
    get: cookieGetter,
    set: cookieSetter,
  });

  const mockFetch = (target: string, init?: RequestInit) => {
    const payload =
      typeof init?.body === "string" ? safeJsonParse(init.body) : {};
    events.push({ type: "beacon", via: "fetch", url: target, payload });
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  };
  // navigator.sendBeacon path is preferred — but if it returns false the
  // snippet falls back to fetch. Our mock always returns true so fetch
  // shouldn't fire for impressions, but cart_check uses fetch directly.

  const mockSetTimeout = (fn: () => void, _ms?: number) => {
    try { fn(); } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "__eh_redirect_thrown__") {
        events.push({ type: "warn", message: `setTimeout threw: ${msg}` });
      }
    }
    return 0 as unknown as ReturnType<typeof setTimeout>;
  };

  const mockConsole = {
    warn: (...args: unknown[]) => events.push({ type: "warn", message: args.map(String).join(" ") }),
    log: () => {},
    error: () => {},
    info: () => {},
  };

  const sessionMap = new Map<string, string>();
  const mockSessionStorage = {
    getItem(k: string) { return sessionMap.get(k) ?? null; },
    setItem(k: string, v: string) {
      sessionMap.set(k, v);
      events.push({ type: "sessionstorage_set", key: k, value: v });
    },
    removeItem(k: string) { sessionMap.delete(k); },
    clear() { sessionMap.clear(); },
    key() { return null; },
    length: 0,
  } as Storage;

  // Wrap in an outer function whose parameters shadow the globals the
  // snippet reads. The snippet's own IIFE remains unchanged.
  const wrapped = `
    return (function(navigator, location, document, fetch, setTimeout, console, sessionStorage){
      try {
        ${snippetBody}
      } catch (e) {
        if (!(e && e.message === "__eh_redirect_thrown__")) {
          _events.push({ type: "fatal", message: e && e.message ? e.message : String(e) });
        }
      }
    });
  `;

  try {
    const factory = new Function("_events", wrapped) as (
      e: TraceEvent[],
    ) => (
      navigator: Navigator,
      location: Location,
      document: Document,
      fetch: typeof window.fetch,
      setTimeout: typeof window.setTimeout,
      console: Console,
      sessionStorage: Storage,
    ) => void;
    factory(events)(
      mockNavigator,
      mockLocation,
      mockDocument,
      mockFetch as unknown as typeof window.fetch,
      mockSetTimeout as unknown as typeof window.setTimeout,
      mockConsole as unknown as Console,
      mockSessionStorage,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== "__eh_redirect_thrown__") {
      events.push({ type: "fatal", message: msg });
    }
  }

  return {
    events,
    cookiesAfter: Array.from(cookies.entries()),
    asyncFlag: opts.asyncTag,
  };
}

export function TraceRunner({ merchants }: { merchants: Merchant[] }) {
  const defaultMerchant = merchants[0]?.id ?? "";
  const [merchantId, setMerchantId] = useState(defaultMerchant);
  const [uaId, setUaId] = useState("ig-ios");
  const [targetInput, setTargetInput] = useState("/products/example?utm_source=ig&utm_medium=paid&fbclid=test");
  const [cookiesRaw, setCookiesRaw] = useState("");
  const [ehForce, setEhForce] = useState<"" | "a" | "b">("");
  const [asyncTag, setAsyncTag] = useState(false);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [installCheck, setInstallCheck] = useState<InstallCheck | null>(null);
  const [installLoading, setInstallLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const merchant = merchants.find((m) => m.id === merchantId);
  const uaPreset = UA_PRESETS.find((p) => p.id === uaId)!;

  async function onRun() {
    if (!merchantId) return;
    setLoading(true);
    setInstallLoading(true);
    setError(null);
    setResult(null);
    setInstallCheck(null);
    try {
      // Fetch the production snippet body. Bust any CDN cache with a
      // unique query so we always trace the latest deployed code.
      const sigil = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const res = await fetch(`/s/${merchantId}.js?v=${sigil}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Snippet fetch failed: ${res.status}`);
      const body = await res.text();

      // Build target URL. Two input modes:
      //   1. Full URL ("https://anywhere.com/path?x=1") — used as-is. Lets
      //      you point at a merchant's actual storefront route, or even a
      //      domain other than the selected merchant's (useful for testing
      //      what the snippet does on staging / preview / a different host).
      //   2. Path only ("/products/x?utm=…") — joined with the selected
      //      merchant's domain.
      const raw = targetInput.trim();
      let targetUrl: string;
      if (/^https?:\/\//i.test(raw)) {
        targetUrl = raw;
      } else {
        const host = merchant?.domain || "example.com";
        const pathAndQuery = raw.startsWith("/") ? raw : `/${raw || ""}`;
        targetUrl = `https://${host}${pathAndQuery}`;
      }
      if (ehForce) {
        targetUrl += (targetUrl.includes("?") ? "&" : "?") + `eh_force=${ehForce}`;
      }

      // Parse cookies field — "k=v; k=v" pairs.
      const cookies: Record<string, string> = {};
      for (const pair of cookiesRaw.split(";")) {
        const eq = pair.indexOf("=");
        if (eq > 0) {
          const k = pair.slice(0, eq).trim();
          const v = pair.slice(eq + 1).trim();
          if (k) cookies[k] = v;
        }
      }

      const r = runTrace(body, {
        ua: uaPreset.ua,
        targetUrl,
        cookies,
        asyncTag,
      });
      setResult(r);

      // Kick off the live install check in the background — independent of
      // the synthetic trace. Tells the operator whether the snippet is
      // actually deployed at the target URL (the synthetic trace assumes
      // it would run; this verifies it actually exists in the HTML).
      void (async () => {
        try {
          const ic = await fetch("/api/admin/install-check", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: targetUrl, merchantId }),
          });
          const data = (await ic.json()) as InstallCheck;
          setInstallCheck(data);
        } catch (e) {
          setInstallCheck({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        } finally {
          setInstallLoading(false);
        }
      })();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setInstallLoading(false);
    } finally {
      setLoading(false);
    }
  }

  // Group UA presets visually
  const groups = Array.from(new Set(UA_PRESETS.map((p) => p.group)));

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      {/* ─── Control panel ───────────────────────────────────── */}
      <div className="card-hi p-5 space-y-5 h-fit">
        <div>
          <div className="eyebrow">Inputs</div>
          <h2 className="mt-1 text-[15px] font-semibold tracking-tight">Synthetic visit</h2>
        </div>

        <Field label="Merchant" hint="Which merchant's snippet to fetch and run.">
          <select
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[13px] font-mono"
          >
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? "(unnamed)"} — {m.domain ?? m.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="User agent" hint="What the synthetic visitor's UA string looks like.">
          <select
            value={uaId}
            onChange={(e) => setUaId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[13px]"
          >
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {UA_PRESETS.filter((p) => p.group === g).map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="mt-1.5 text-[10.5px] font-mono text-[var(--color-fg-muted)] leading-snug break-all">
            {uaPreset.ua}
          </div>
        </Field>

        <Field
          label="URL or path"
          hint="Full URL (https://anywhere.com/path) — used as-is. Or a path (/products/x?…) — joined with the selected merchant's domain. Tip: paste a real ad-clicked URL to reproduce exactly what a paid visitor sees."
        >
          <input
            type="text"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="https://andar.com/products/x  —or—  /products/example?utm_source=ig"
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] font-mono"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { l: "Paid IG ad", v: "/?utm_source=ig&utm_medium=paid&fbclid=test" },
              { l: "Organic IG", v: "/?utm_source=ig" },
              { l: "Product page", v: "/products/example" },
              { l: "Cart", v: "/cart" },
              { l: "Post-escape", v: "/?opened_external_browser=true" },
            ].map((preset) => (
              <button
                key={preset.l}
                type="button"
                onClick={() => setTargetInput(preset.v)}
                className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:border-[var(--color-border)] transition-colors"
              >
                {preset.l}
              </button>
            ))}
          </div>
        </Field>

        <Field label="eh_force override" hint="Forces bucket regardless of AB / paid_only state. Adds the param to the URL.">
          <div className="flex gap-1.5">
            {([
              { v: "" as const, label: "none" },
              { v: "a" as const, label: "a (escape)" },
              { v: "b" as const, label: "b (silent)" },
            ]).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setEhForce(opt.v)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-mono transition-colors ${
                  ehForce === opt.v
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30"
                    : "bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Cookies"
          hint='Format: "eh_b=a; eh_sid=…". Pre-loads the synthetic visitor with these cookies. Leave blank for a true first-time visitor.'
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={cookiesRaw}
              onChange={(e) => setCookiesRaw(e.target.value)}
              placeholder="eh_b=a"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] font-mono"
            />
            <button
              type="button"
              onClick={() => setCookiesRaw("")}
              disabled={cookiesRaw.length === 0}
              className="px-3 py-2 rounded-lg text-[11px] font-mono text-[var(--color-fg-dim)] bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] hover:text-[var(--color-fg)] hover:border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Clear cookie field"
            >
              clear
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[
              { l: "Bucket A pinned", v: "eh_b=a" },
              { l: "Bucket B pinned", v: "eh_b=b" },
              { l: "Returning + sid", v: "eh_b=a; eh_sid=abc-123" },
              { l: "Shopify visitor", v: "_shopify_y=shopify-y-value" },
            ].map((preset) => (
              <button
                key={preset.l}
                type="button"
                onClick={() => setCookiesRaw(preset.v)}
                className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:border-[var(--color-border)] transition-colors"
              >
                {preset.l}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10.5px] text-[var(--color-fg-muted)] font-mono leading-snug">
            Each run starts from a clean slate — fresh sessionStorage, fresh snippet fetch (no-cache), cookies = only what&apos;s in this field at run time. Nothing carries over from prior runs.
          </div>
        </Field>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={asyncTag}
            onChange={(e) => setAsyncTag(e.target.checked)}
            className="size-4 accent-[var(--color-danger)]"
          />
          <div>
            <div className="text-[13px] font-medium tracking-tight">
              Pretend script tag has <code className="font-mono">async</code>
            </div>
            <div className="text-[11px] text-[var(--color-fg-muted)]">
              Triggers v10&apos;s self-diagnostic. <code className="font-mono">as:1</code> on every beacon.
            </div>
          </div>
        </label>

        <button
          type="button"
          disabled={loading}
          onClick={onRun}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[13px] font-medium press lift focus-ring disabled:opacity-60"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          {loading ? "Running…" : "Run trace"}
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 3l8 5-8 5V3z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ─── Result panel ─────────────────────────────────────── */}
      <div className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/30 px-5 py-4 text-[13px]">
            <strong className="text-[var(--color-danger)]">Trace failed</strong>{" "}
            <span className="text-[var(--color-fg-dim)] font-mono">— {error}</span>
          </div>
        ) : null}

        {installLoading || installCheck ? (
          <InstallCheckPanel data={installCheck} loading={installLoading} />
        ) : null}

        {result ? (
          <ResultPanel result={result} />
        ) : !error && !loading ? (
          <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-6 py-10 text-center">
            <div className="text-[13px] text-[var(--color-fg-dim)]">
              Pick a merchant + UA, then run the trace. The compiled snippet executes against a synthetic environment — no real network calls leave this page.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: TraceResult }) {
  const { events } = result;
  const beacons = events.filter((e): e is Extract<TraceEvent, { type: "beacon" }> => e.type === "beacon");
  const redirect = events.find((e): e is Extract<TraceEvent, { type: "redirect" }> => e.type === "redirect");
  const warns = events.filter((e): e is Extract<TraceEvent, { type: "warn" }> => e.type === "warn");
  const fatals = events.filter((e): e is Extract<TraceEvent, { type: "fatal" }> => e.type === "fatal");
  const impression = beacons.find((b) => b.payload.t === "impression");
  const escapeAttempt = beacons.find((b) => b.payload.t === "escape_attempt");
  const escapeSkipped = beacons.find((b) => b.payload.t === "escape_skipped");

  // Compute the headline verdict
  let verdict: "escape" | "silent" | "skipped" | "non-meta" | "desktop" | "error";
  let verdictDetail: string;
  if (fatals.length > 0) {
    verdict = "error";
    verdictDetail = fatals[0].message;
  } else if (redirect) {
    verdict = "escape";
    verdictDetail = `Would redirect to ${redirect.url.slice(0, 60)}…`;
  } else if (escapeSkipped) {
    const r = String(escapeSkipped.payload.r ?? "?");
    verdict = "skipped";
    const reason: Record<string, string> = {
      k: "kill switch on (escape_enabled=false)",
      s: "sessionStorage eh_a sticky (already attempted)",
      f: "sessionStorage eh_fb sticky (FB already attempted)",
    };
    verdictDetail = reason[r] ?? `reason: ${r}`;
  } else if (impression && impression.payload.b === "b") {
    verdict = "silent";
    verdictDetail = "Bucket B silent return (A/B control arm)";
  } else if (impression && (impression.payload.ig === 0 || impression.payload.it === 0)) {
    verdict = "non-meta";
    verdictDetail = "Visitor is not in test population (UA isn't IG/Threads or paid_only filtered it out)";
  } else if (beacons.length === 0) {
    verdict = "desktop";
    verdictDetail = "Snippet bailed early — not a mobile UA, or unsupported IAB";
  } else {
    verdict = "silent";
    verdictDetail = "No redirect attempted and no skip beacon — verify trace below";
  }

  const verdictStyle: Record<string, string> = {
    escape: "border-[var(--color-success)]/40 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] text-[var(--color-success)]",
    silent: "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 text-[var(--color-accent)]",
    skipped: "border-[var(--color-warn,#c98a18)]/40 bg-[color-mix(in_srgb,var(--color-warn,#c98a18)_8%,transparent)]",
    "non-meta": "border-[var(--color-border)] bg-[var(--color-bg-elev)] text-[var(--color-fg-dim)]",
    desktop: "border-[var(--color-border)] bg-[var(--color-bg-elev)] text-[var(--color-fg-dim)]",
    error: "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/30 text-[var(--color-danger)]",
  };
  const verdictLabel: Record<string, string> = {
    escape: "WOULD ESCAPE",
    silent: "SILENT (CONTROL)",
    skipped: "SKIPPED",
    "non-meta": "OUT OF TEST",
    desktop: "BAILED EARLY",
    error: "ERROR",
  };

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className={`rounded-xl border px-5 py-4 ${verdictStyle[verdict]}`}>
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono opacity-80">Verdict</div>
        <div className="mt-1 text-[16px] font-semibold tracking-tight">{verdictLabel[verdict]}</div>
        <div className="mt-1 text-[12.5px] opacity-90 leading-snug">{verdictDetail}</div>
      </div>

      {/* Critical flags */}
      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
        <div className="eyebrow">Flags</div>
        <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11.5px] font-mono">
          <FlagPill label="async tag" on={result.asyncFlag} danger />
          <FlagPill label="bucket" value={impression ? String(impression.payload.b ?? "?") : "—"} />
          <FlagPill label="in test" value={impression ? (impression.payload.it ? "1" : "0") : "—"} />
          <FlagPill label="kind" value={impression ? String(impression.payload.k ?? "—") : "—"} />
          <FlagPill label="forced" on={impression?.payload.forced === 1} />
          <FlagPill label="postEscape" on={String(impression?.payload.u ?? "").includes("opened_external_browser=true")} />
          <FlagPill label="redirect fired" on={!!redirect} />
          <FlagPill label="skip beacon" on={!!escapeSkipped} danger />
        </div>
      </div>

      {/* Step-by-step trace */}
      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)] flex items-center justify-between">
          <div>
            <div className="eyebrow">Trace</div>
            <div className="text-[11.5px] text-[var(--color-fg-muted)] font-mono mt-0.5">
              {events.length} event{events.length === 1 ? "" : "s"} captured
            </div>
          </div>
          {escapeAttempt ? (
            <span className="pill pill-success font-mono text-[10px]">escape_attempt fired</span>
          ) : null}
        </div>
        {events.length === 0 ? (
          <div className="px-5 py-6 text-[12px] text-[var(--color-fg-muted)] font-mono">
            No side effects. Snippet returned without firing beacons or redirects — most likely the UA failed the mobile gate.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border-soft)]">
            {events.map((e, i) => (
              <li key={i} className="px-5 py-3 text-[12px] font-mono leading-snug">
                <EventRow event={e} index={i} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Warnings */}
      {warns.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/30 px-5 py-4">
          <div className="eyebrow text-[var(--color-danger)]">Warnings</div>
          <ul className="mt-2 space-y-1.5 text-[12px] font-mono">
            {warns.map((w, i) => <li key={i}>⚠ {w.message}</li>)}
          </ul>
        </div>
      ) : null}

      {/* Cookies after */}
      {result.cookiesAfter.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
          <div className="eyebrow">Cookies after run</div>
          <div className="mt-2 text-[11.5px] font-mono text-[var(--color-fg-dim)] break-all">
            {result.cookiesAfter.map(([k, v]) => `${k}=${v}`).join("; ")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlagPill({ label, value, on, danger }: { label: string; value?: string; on?: boolean; danger?: boolean }) {
  const hasValue = value !== undefined;
  const isOn = hasValue ? value !== "—" && value !== "0" : !!on;
  const tone = danger
    ? isOn
      ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30"
      : "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20"
    : isOn
      ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30"
      : "bg-[var(--color-bg-elev)] border-[var(--color-border-soft)] text-[var(--color-fg-muted)]";
  return (
    <div className={`rounded-md border px-2 py-1.5 ${tone}`}>
      <div className="text-[9.5px] uppercase tracking-[0.14em] opacity-70">{label}</div>
      <div className="mt-0.5 text-[12px] font-semibold">
        {hasValue ? value : (on ? "yes" : "no")}
      </div>
    </div>
  );
}

function EventRow({ event, index }: { event: TraceEvent; index: number }) {
  const idx = (
    <span className="inline-block w-7 text-[var(--color-fg-muted)] tnum">{String(index + 1).padStart(2, "0")}</span>
  );
  if (event.type === "beacon") {
    const t = String(event.payload.t ?? "?");
    const b = String(event.payload.b ?? "");
    const it = event.payload.it;
    const r = event.payload.r;
    const ck = event.payload.ck;
    return (
      <div>
        {idx}
        <span className="px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-[10.5px] mr-2">{event.via}</span>
        <span className="font-semibold text-[var(--color-fg)]">{t}</span>
        {b ? <span className="ml-2 text-[var(--color-fg-dim)]">bucket={b}</span> : null}
        {typeof it === "number" || typeof it === "boolean" ? <span className="ml-2 text-[var(--color-fg-dim)]">it={String(it)}</span> : null}
        {r !== undefined ? <span className="ml-2 text-[var(--color-fg-dim)]">r={String(r)}</span> : null}
        {ck !== undefined ? <span className="ml-2 text-[var(--color-fg-dim)]">ck={String(ck)}</span> : null}
        <details className="mt-1 ml-7 text-[11px] text-[var(--color-fg-muted)]">
          <summary className="cursor-pointer">payload</summary>
          <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(event.payload, null, 2)}</pre>
        </details>
      </div>
    );
  }
  if (event.type === "redirect") {
    return (
      <div>
        {idx}
        <span className="px-1.5 py-0.5 rounded bg-[var(--color-success)]/15 text-[var(--color-success)] text-[10.5px] mr-2">redirect</span>
        <span className="text-[var(--color-fg)] break-all">{event.url}</span>
      </div>
    );
  }
  if (event.type === "navigate") {
    return (
      <div>
        {idx}
        <span className="px-1.5 py-0.5 rounded bg-[var(--color-warn,#c98a18)]/15 text-[var(--color-warn,#c98a18)] text-[10.5px] mr-2">href=</span>
        <span className="text-[var(--color-fg)] break-all">{event.url}</span>
      </div>
    );
  }
  if (event.type === "cookie_set") {
    return (
      <div>
        {idx}
        <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] text-[10.5px] mr-2">cookie</span>
        <span className="text-[var(--color-fg)]">{event.name}</span>
        <span className="text-[var(--color-fg-muted)]"> = </span>
        <span className="text-[var(--color-fg-dim)] break-all">{event.value}</span>
      </div>
    );
  }
  if (event.type === "sessionstorage_set") {
    return (
      <div>
        {idx}
        <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] text-[10.5px] mr-2">sessionStorage</span>
        <span className="text-[var(--color-fg)]">{event.key}</span>
        <span className="text-[var(--color-fg-muted)]"> = </span>
        <span className="text-[var(--color-fg-dim)]">{event.value}</span>
      </div>
    );
  }
  if (event.type === "warn") {
    return (
      <div>
        {idx}
        <span className="px-1.5 py-0.5 rounded bg-[var(--color-danger)]/15 text-[var(--color-danger)] text-[10.5px] mr-2">warn</span>
        <span className="text-[var(--color-fg-dim)] break-all">{event.message}</span>
      </div>
    );
  }
  return (
    <div>
      {idx}
      <span className="px-1.5 py-0.5 rounded bg-[var(--color-danger)]/15 text-[var(--color-danger)] text-[10.5px] mr-2">fatal</span>
      <span className="text-[var(--color-danger)] break-all">{event.message}</span>
    </div>
  );
}

/** Live install verification panel. Distinct from the synthetic trace —
 *  the trace says "would the snippet escape if it ran"; this says "is
 *  the snippet actually deployed at this URL". Both are necessary. */
function InstallCheckPanel({ data, loading }: { data: InstallCheck | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-5 py-4">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">
          Live install check
        </div>
        <div className="mt-2 text-[12.5px] text-[var(--color-fg-dim)] font-mono flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
          Fetching {/* target URL would be nice here but we don't have it in scope */} target HTML…
        </div>
      </div>
    );
  }
  if (!data) return null;

  if (!data.ok) {
    return (
      <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/30 px-5 py-4">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-danger)]">
          Live install check — failed
        </div>
        <div className="mt-1.5 text-[13px] font-semibold tracking-tight text-[var(--color-fg)]">
          Couldn&apos;t fetch the target page
        </div>
        <div className="mt-1 text-[12px] text-[var(--color-fg-dim)] font-mono break-all">
          {data.stage ? `[${data.stage}] ` : ""}{data.error}
        </div>
        <div className="mt-2 text-[11px] text-[var(--color-fg-muted)] leading-snug">
          Common causes: target URL is unreachable (DNS, 5xx), anti-bot blocked our fetch (rare with IG UA),
          or the URL itself is invalid. The synthetic trace below is still valid —
          it just tests the snippet&apos;s logic, not deployment.
        </div>
      </div>
    );
  }

  // Three verdict states: installed correctly / installed with async problem / not installed
  const installed = data.snippetFound;
  const problem = installed && (data.hasAsync || data.hasDefer);

  if (!installed && data.anyEscapeHatchTag) {
    // Snippet present BUT pointed at a different merchant ID — install mistake.
    return (
      <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/30 px-5 py-4 space-y-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-danger)]">
          Live install check — wrong merchant ID
        </div>
        <div className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
          EscapeHatch is installed on this URL, but with the wrong merchant ID
        </div>
        <div className="text-[12px] text-[var(--color-fg-dim)] leading-snug">
          Expected{" "}
          <code className="font-mono text-[11.5px] bg-[var(--color-bg-elev)] px-1 py-0.5 rounded">
            {data.expectedMerchantId}
          </code>
          {" "}— found{" "}
          {data.wrongMerchantTags.map((t, i) => (
            <span key={i}>
              <code className="font-mono text-[11.5px] bg-[var(--color-bg-elev)] px-1 py-0.5 rounded">
                {t.merchantId}
              </code>
              {i < data.wrongMerchantTags.length - 1 ? ", " : ""}
            </span>
          ))}
          .
        </div>
        <div className="text-[11px] text-[var(--color-fg-muted)] font-mono break-all">
          {data.finalUrl} · {data.status} · {(data.bytesRead / 1024).toFixed(0)} KB
        </div>
      </div>
    );
  }

  if (!installed) {
    return (
      <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/30 px-5 py-4 space-y-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-danger)]">
          Live install check — NOT INSTALLED
        </div>
        <div className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
          Snippet not found in this URL&apos;s head
        </div>
        <div className="text-[12.5px] text-[var(--color-fg-dim)] leading-snug">
          The synthetic trace below assumes the snippet runs. It doesn&apos;t — there&apos;s no{" "}
          <code className="font-mono text-[11.5px] bg-[var(--color-bg-elev)] px-1 py-0.5 rounded">
            &lt;script src=&quot;https://getescapehatch.com/s/{data.expectedMerchantId}.js?v=...&quot;&gt;
          </code>
          {" "}in the served <code className="font-mono">head</code>. Querystrings like <code className="font-mono">?v=9</code> are accepted.
        </div>
        <div className="text-[11px] text-[var(--color-fg-muted)] font-mono break-all">
          {data.finalUrl} · {data.status} · scanned {data.scannedRegion === "head_fallback" ? "before body/head fallback" : "head"} · {(data.bytesRead / 1024).toFixed(0)} KB read
          {data.truncated ? " (truncated at 3MB)" : ""}
        </div>
      </div>
    );
  }

  if (problem) {
    return (
      <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]/30 px-5 py-4 space-y-3">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-danger)]">
          Live install check — async/defer detected
        </div>
        <div className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
          Snippet is installed but will be silently dropped by Instagram
        </div>
        <div className="text-[12.5px] text-[var(--color-fg-dim)] leading-snug">
          The script tag has{" "}
          {data.hasAsync ? <code className="font-mono text-[11.5px] bg-[var(--color-bg-elev)] px-1 py-0.5 rounded">async</code> : null}
          {data.hasAsync && data.hasDefer ? " + " : null}
          {data.hasDefer ? <code className="font-mono text-[11.5px] bg-[var(--color-bg-elev)] px-1 py-0.5 rounded">defer</code> : null}
          {" "}— the IG WebView commits to rendering before our snippet runs, and the{" "}
          <code className="font-mono text-[11.5px] bg-[var(--color-bg-elev)] px-1 py-0.5 rounded">extbrowser</code>{" "}
          scheme is silently dropped. Remove the attribute. Check whether Edgemesh or a theme-optimizer app is auto-adding it.
        </div>
        <details className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">
          <summary className="cursor-pointer">found tag</summary>
          <pre className="mt-1 whitespace-pre-wrap break-all">{data.tag}</pre>
        </details>
        <div className="text-[11px] text-[var(--color-fg-muted)] font-mono break-all">
          {data.finalUrl} · {data.status} · position: {data.position ?? "?"}
        </div>
      </div>
    );
  }

  // Happy path
  return (
    <div className="rounded-xl border border-[var(--color-success)]/40 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] px-5 py-4 space-y-2">
      <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-success)]">
        Live install check — installed correctly
      </div>
      <div className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
        Snippet found, sync, in {data.position === "head" ? <>{"<head>"}</> : <>the document</>}
      </div>
      <details className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">
        <summary className="cursor-pointer">found tag</summary>
        <pre className="mt-1 whitespace-pre-wrap break-all">{data.tag}</pre>
      </details>
      <div className="text-[11px] text-[var(--color-fg-muted)] font-mono break-all">
        {data.finalUrl} · {data.status} · scanned {data.scannedRegion === "head_fallback" ? "before body/head fallback" : "head"} · {data.src ?? "snippet src found"}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[12.5px] font-medium tracking-tight">{label}</div>
      {hint ? <div className="text-[11px] text-[var(--color-fg-muted)] mt-0.5 leading-snug">{hint}</div> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}
