"use client";

// On-device in-app-browser lab. Everything here runs INSIDE the IAB (Instagram,
// Threads, FB, TikTok...) so we can see what the WebView exposes to a page and
// which escape mechanism actually fires, without needing Safari Web Inspector
// (IG ships its WebView with inspection disabled on most builds).
//
// Open it by DM'ing yourself https://getescapehatch.com/lab and tapping the link.

import { useCallback, useEffect, useState } from "react";

type Row = { label: string; value: string };

function detectKind(ua: string): string {
  if (/Barcelona/i.test(ua)) return "threads";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV/i.test(ua)) return /Messenger/i.test(ua) ? "messenger" : "facebook";
  if (/Messenger/i.test(ua)) return "messenger";
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "tiktok";
  if (/Snapchat/i.test(ua)) return "snapchat";
  if (/Pinterest/i.test(ua)) return "pinterest";
  if (/Discord/i.test(ua)) return "discord";
  if (/(?:; wv\)|; wv;|WebView)/i.test(ua)) return "webview";
  return "none (not an in-app browser)";
}

// A pristine same-origin iframe gives us a baseline `window` that WebKit built
// without any page script running. Diffing the top window against it surfaces
// exactly what the host app injected — comparing against a hardcoded list is
// useless because window's own-property set IS the entire standard API surface.
function injectedGlobals(): string[] {
  try {
    const f = document.createElement("iframe");
    f.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0";
    document.body.appendChild(f);
    const clean = f.contentWindow as unknown as Window | null;
    if (!clean) return ["<no iframe contentWindow>"];
    const baseline = new Set(Object.getOwnPropertyNames(clean));
    const out = Object.getOwnPropertyNames(window).filter((k) => !baseline.has(k));
    f.remove();
    return out;
  } catch (e) {
    return [`<error: ${String(e)}>`];
  }
}

// IG routes scheme URLs through an internal deeplink table. `extbrowser` is
// gated on current builds; these are other plausible route names for the same
// native "open outside the app" handler. Probing them is black-box: each is a
// real anchor, so the tap is a genuine user gesture (the strongest signal we
// can send), and the hidden-watcher tells us if any of them reached the OS.
const CANDIDATE_SCHEMES: { label: string; build: (u: string) => string }[] = [
  { label: "instagram://extbrowser", build: (u) => "instagram://extbrowser/?url=" + encodeURIComponent(u) },
  { label: "instagram://external_browser", build: (u) => "instagram://external_browser/?url=" + encodeURIComponent(u) },
  { label: "instagram://open_external", build: (u) => "instagram://open_external/?url=" + encodeURIComponent(u) },
  { label: "instagram://openexternal", build: (u) => "instagram://openexternal/?url=" + encodeURIComponent(u) },
  { label: "instagram://open_in_browser", build: (u) => "instagram://open_in_browser/?url=" + encodeURIComponent(u) },
  { label: "instagram://open_in_external_browser", build: (u) => "instagram://open_in_external_browser/?url=" + encodeURIComponent(u) },
  { label: "instagram://browser", build: (u) => "instagram://browser/?url=" + encodeURIComponent(u) },
  { label: "instagram://openurl", build: (u) => "instagram://openurl?url=" + encodeURIComponent(u) },
  { label: "instagram://open", build: (u) => "instagram://open?url=" + encodeURIComponent(u) },
  { label: "instagram://safari", build: (u) => "instagram://safari/?url=" + encodeURIComponent(u) },
  { label: "instagram://webview_external", build: (u) => "instagram://webview_external/?url=" + encodeURIComponent(u) },
  { label: "fb://extbrowser", build: (u) => "fb://extbrowser/?url=" + encodeURIComponent(u) },
  { label: "fb://browser", build: (u) => "fb://browser/?url=" + encodeURIComponent(u) },
  { label: "barcelona://extbrowser", build: (u) => "barcelona://extbrowser/?url=" + encodeURIComponent(u) },
  { label: "shortcuts://run-shortcut", build: (u) => "shortcuts://run-shortcut?name=Open&input=" + encodeURIComponent(u) },
];

export function Lab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [handlers, setHandlers] = useState<string[]>([]);
  const [globals, setGlobals] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [hiddenSeen, setHiddenSeen] = useState(false);
  // Schemes are computed from location, which only exists in the browser; the
  // anchor below renders inert until mount so prerender does not touch it.
  const [mounted, setMounted] = useState(false);

  const say = useCallback((m: string) => {
    setLog((l) => [`${new Date().toISOString().slice(11, 23)}  ${m}`, ...l]);
  }, []);

  useEffect(() => {
    setMounted(true);
    const ua = navigator.userAgent || "";
    const w = window as unknown as Record<string, unknown>;

    // 1. What native message handlers does this WebView expose to the page?
    let hs: string[] = [];
    try {
      const mh = (w.webkit as { messageHandlers?: Record<string, unknown> } | undefined)
        ?.messageHandlers;
      if (mh) hs = Object.keys(mh);
    } catch (e) {
      hs = [`<error reading webkit.messageHandlers: ${String(e)}>`];
    }
    setHandlers(hs);

    // 2. What did the host app inject on top of a pristine WebKit window?
    const gs = injectedGlobals();
    setGlobals(gs);

    setRows([
      { label: "userAgent", value: ua },
      { label: "detected kind", value: detectKind(ua) },
      { label: "platform", value: /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : "other" },
      { label: "url", value: location.href },
      { label: "referrer", value: document.referrer || "(none)" },
      { label: "webkit.messageHandlers", value: hs.length ? `${hs.length} handler(s)` : "absent / empty" },
      { label: "injected globals", value: gs.length ? `${gs.length} found` : "none" },
      { label: "IABMV token", value: /IABMV\/(\d+)/.exec(ua)?.[1] ?? "absent" },
      { label: "IG app version", value: /Instagram ([\d.]+)/.exec(ua)?.[1] ?? "n/a" },
      { label: "standalone", value: String((navigator as unknown as { standalone?: boolean }).standalone) },
      { label: "visibilityState", value: document.visibilityState },
    ]);

    // Any escape that works sends the page to the background. Watching for that
    // is how we tell "the scheme fired" from "the scheme was swallowed".
    const onVis = () => {
      if (document.hidden) {
        setHiddenSeen(true);
        say("document.hidden = true  ->  something DID open outside the IAB");
      }
    };
    document.addEventListener("visibilitychange", onVis);


    return () => document.removeEventListener("visibilitychange", onVis);
  }, [say]);

  // Carry a realistic param set so the landing banner can show which params
  // survived whichever route actually works.
  const dest = useCallback(() => {
    try {
      const u = new URL(location.href);
      u.searchParams.delete("auto");
      u.searchParams.set("escaped", "1");
      u.searchParams.set("opened_external_browser", "true");
      u.searchParams.set("eh_sid", "0123abcd-4567-89ef-0123-456789abcdef");
      u.searchParams.set("utm_source", "instagram");
      u.searchParams.set("utm_medium", "paid");
      u.searchParams.set("eh_fbclid", "IwTESTCLICKID123");
      return u.toString();
    } catch {
      return location.href;
    }
  }, []);

  // Meta's extbrowser route. Gated behind the consent modal on IG 444, kept so
  // we can re-test it whenever Instagram ships a new build.
  const igScheme = useCallback(() => {
    const ua = navigator.userAgent || "";
    const prefix =
      detectKind(ua) === "threads"
        ? "barcelona://extbrowser/?url="
        : "instagram://extbrowser/?url=";
    return prefix + encodeURIComponent(dest());
  }, [dest]);

  // Android's Chrome handoff — the one route that still works unattended.
  const androidIntent = useCallback(() => {
    const d = dest();
    return (
      "intent://" + d.replace(/^https?:\/\//, "") +
      "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
      encodeURIComponent(d) + ";end"
    );
  }, [dest]);

  const b64url = useCallback(
    (t: string) => btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    [],
  );



  // JS-initiated navigation. Kept only as a control: the WebView drops these
  // silently for a blocked scheme, which is why a dead button looks identical
  // to a dead route.
  const fire = useCallback(
    (label: string, url: string) => {
      setHiddenSeen(false);
      say(`firing ${label}: ${url.slice(0, 90)}`);
      try {
        location.replace(url);
      } catch (e) {
        say(`location.replace threw: ${String(e)}`);
      }
      setTimeout(() => {
        if (!document.hidden) say(`${label}: still foreground after 1.2s`);
      }, 1200);
    },
    [say],
  );

  const probeHandler = useCallback(
    (name: string) => {
      try {
        const mh = (window as unknown as { webkit?: { messageHandlers?: Record<string, { postMessage: (m: unknown) => void }> } })
          .webkit?.messageHandlers;
        const h = mh?.[name];
        if (!h) return say(`handler ${name} missing`);
        h.postMessage({ url: dest(), type: "open_external", source: "lab" });
        say(`postMessage sent to ${name} — watch for a browser switch`);
      } catch (e) {
        say(`postMessage to ${name} threw: ${String(e)}`);
      }
    },
    [dest, say],
  );

  const btn: React.CSSProperties = {
    display: "block", width: "100%", padding: "14px 16px", marginBottom: 8,
    background: "#fff", color: "#000", border: "none", borderRadius: 10,
    fontSize: 15, fontWeight: 700, textAlign: "left", cursor: "pointer",
  };
  const mono: React.CSSProperties = {
    fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
    fontSize: 11, lineHeight: 1.5, wordBreak: "break-all",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0c", color: "#fff", padding: 16, ...mono }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, fontFamily: "system-ui" }}>
        IAB lab
      </h1>
      <p style={{ opacity: 0.6, marginBottom: 16, fontFamily: "system-ui", fontSize: 13 }}>
        Open this inside the app&apos;s in-app browser (DM yourself the link and tap it).
      </p>

      <Landed />

      <Section title="Environment">
        {rows.map((r) => (
          <div key={r.label} style={{ marginBottom: 6 }}>
            <span style={{ opacity: 0.5 }}>{r.label}: </span>
            <span>{r.value}</span>
          </div>
        ))}
      </Section>

      <Section title={`webkit.messageHandlers (${handlers.length})`}>
        {handlers.length === 0 ? (
          <div style={{ opacity: 0.5 }}>none — the page has no native bridge; the URL scheme is the only door.</div>
        ) : (
          handlers.map((h) => (
            <button key={h} style={btn} onClick={() => probeHandler(h)}>
              postMessage → {h}
            </button>
          ))
        )}
      </Section>

      <Section title={`Injected globals (${globals.length})`}>
        {globals.length === 0 ? (
          <div style={{ opacity: 0.5 }}>none</div>
        ) : (
          <div>{globals.join(", ")}</div>
        )}
      </Section>

      <Section title="Near-automatic: fire on first interaction">
        <p style={{ opacity: 0.55, marginBottom: 12 }}>
          Arms a one-shot document listener. Your next touch anywhere — a scroll or a
          tap — fires instagram://extbrowser. This is the closest to automatic iOS
          allows: no button to find, but the OS still requires that real gesture and
          still shows its confirm sheet. Watch whether the sheet appears the first
          time only or every time.
        </p>
        <button
          style={{ ...btn, background: "#93c5fd" }}
          onClick={() => {
            say("armed — touch anywhere to fire extbrowser");
            const fireOnce = () => {
              document.removeEventListener("pointerdown", fireOnce, true);
              document.removeEventListener("touchend", fireOnce, true);
              say("first interaction captured -> navigating to extbrowser");
              const a = document.createElement("a");
              a.href = igScheme();
              document.body.appendChild(a);
              a.click();
            };
            document.addEventListener("pointerdown", fireOnce, true);
            document.addEventListener("touchend", fireOnce, true);
          }}
        >
          Arm first-interaction auto-fire
        </button>
        <button
          style={{ ...btn, background: "#c4b5fd" }}
          onClick={() => {
            say("iframe-src fire (tests whether a gesture-free sub-navigation slips the sheet)");
            const f = document.createElement("iframe");
            f.style.display = "none";
            f.src = igScheme();
            document.body.appendChild(f);
            setTimeout(() => {
              if (!document.hidden) say("iframe: still foreground — dropped");
            }, 1200);
          }}
        >
          iframe src = extbrowser (control, expect drop)
        </button>
      </Section>

      <Section title="Escape attempts">
        <p style={{ opacity: 0.55, marginBottom: 12 }}>
          Every row below is a real &lt;a href&gt; — a genuine user-activated navigation.
          JS-fired location.replace() to a blocked scheme is dropped silently by the
          WebView with no modal at all, which is why the old buttons appeared dead.
        </p>
        {(
          [
            ["instagram://extbrowser", () => igScheme()],
            ["android intent:// → Chrome", () => androidIntent()],
            ["x-safari-https://", () => dest().replace(/^https?:/, "x-safari-https:")],
            ["googlechrome://x-callback-url", () => "googlechrome://x-callback-url/open?url=" + encodeURIComponent(dest())],
          ] as [string, () => string][]
        ).map(([label, build]) => (
          <a
            key={label}
            style={{ ...btn, textDecoration: "none" }}
            href={mounted ? build() : "#"}
            onClick={() => {
              setHiddenSeen(false);
              say(`tapped ${label}`);
              setTimeout(() => {
                if (!document.hidden) say(`${label}: still foreground after 1.5s`);
              }, 1500);
            }}
          >
            {label}
          </a>
        ))}
        <button
          style={{ ...btn, background: "#fca5a5" }}
          onClick={() => fire("JS-fired extbrowser (control)", igScheme())}
        >
          JS-fired extbrowser (control — expect silence)
        </button>
      </Section>

      <Section title={`Scheme probe (${CANDIDATE_SCHEMES.length} candidates, tap each)`}>
        <p style={{ opacity: 0.5, marginBottom: 10 }}>
          Real anchors — the tap is a genuine user gesture. Watch the Result box: green
          means that route reached the OS.
        </p>
        {CANDIDATE_SCHEMES.map((c) => (
          <a
            key={c.label}
            style={{ ...btn, textDecoration: "none" }}
            href={mounted ? c.build(dest()) : "#"}
            onClick={() => {
              setHiddenSeen(false);
              say(`tapped ${c.label}`);
              setTimeout(() => {
                if (!document.hidden) say(`${c.label}: still foreground after 1.2s — dead route`);
              }, 1200);
            }}
          >
            {c.label}
          </a>
        ))}
      </Section>

      <Section title="Result">
        <div style={{ marginBottom: 8 }}>
          backgrounded since last attempt:{" "}
          <b style={{ color: hiddenSeen ? "#4ade80" : "#f87171" }}>{hiddenSeen ? "YES (escape worked)" : "no"}</b>
        </div>
        {log.map((l, i) => (
          <div key={i} style={{ opacity: i === 0 ? 1 : 0.55, marginBottom: 3 }}>{l}</div>
        ))}
      </Section>
    </div>
  );
}

// Shown when we arrive carrying ?escaped=1 — i.e. this load is the far side of
// a successful hop. Prints every param so we can see which survived.
function Landed() {
  const [params, setParams] = useState<[string, string][] | null>(null);
  useEffect(() => {
    // Unpack the fragment token first — that is how the real snippet restores
    // the query after a token-carrying hop.
    try {
      const h = location.hash || "";
      if (h.indexOf("#eh1.") === 0) {
        let b = h.slice(5).replace(/-/g, "+").replace(/_/g, "/");
        while (b.length % 4) b += "=";
        history.replaceState(null, "", location.pathname + "?" + atob(b));
      }
    } catch { /* ignore */ }
    const q = new URLSearchParams(location.search);
    if (q.get("escaped") !== "1" && q.get("opened_external_browser") !== "true") return;
    setParams([...q.entries()]);
  }, []);
  if (!params) return null;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const stillIab = /Instagram|FBAN|FBAV|Barcelona/i.test(ua);
  return (
    <div style={{ background: stillIab ? "#7f1d1d" : "#14532d", padding: 14, borderRadius: 10, marginBottom: 20 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, fontFamily: "system-ui" }}>
        {stillIab ? "LANDED — but still inside the in-app browser" : "LANDED IN A REAL BROWSER"}
      </div>
      <div style={{ marginBottom: 6, opacity: 0.85 }}>{params.length} param(s) survived the hop:</div>
      {params.map(([k, v]) => (
        <div key={k} style={{ opacity: 0.9 }}>
          {k} = {v}
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22, borderTop: "1px solid #262629", paddingTop: 12 }}>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.45, marginBottom: 10, fontFamily: "system-ui" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
