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

  const dest = useCallback(() => {
    try {
      const u = new URL(location.href);
      u.searchParams.set("escaped", "1");
      return u.toString();
    } catch {
      return location.href;
    }
  }, []);

  const igScheme = useCallback(() => {
    const ua = navigator.userAgent || "";
    const kind = detectKind(ua);
    const prefix = kind === "threads" ? "barcelona://extbrowser/?url=" : "instagram://extbrowser/?url=";
    return prefix + encodeURIComponent(dest());
  }, [dest]);

  const androidIntent = useCallback(() => {
    const d = dest();
    return (
      "intent://" + d.replace(/^https?:\/\//, "") +
      "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
      encodeURIComponent(d) + ";end"
    );
  }, [dest]);

  const fire = useCallback(
    (label: string, url: string) => {
      setHiddenSeen(false);
      say(`firing ${label}: ${url.slice(0, 90)}`);
      try {
        location.replace(url);
      } catch (e) {
        say(`location.replace threw: ${String(e)} — trying location.href`);
        try {
          location.href = url;
        } catch (e2) {
          say(`location.href threw too: ${String(e2)}`);
        }
      }
      // If nothing has backgrounded us after ~1.2s the navigation was swallowed.
      setTimeout(() => {
        if (!document.hidden) say(`${label}: still foreground after 1.2s — swallowed or prompt shown`);
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

      <Section title="Escape attempts (tap = user gesture)">
        <button style={btn} onClick={() => fire("extbrowser (tap)", igScheme())}>
          1. instagram/barcelona://extbrowser — on tap
        </button>
        <button style={btn} onClick={() => setTimeout(() => fire("extbrowser (auto)", igScheme()), 400)}>
          2. same scheme, fired 400ms later (no gesture)
        </button>
        <button style={btn} onClick={() => fire("android intent", androidIntent())}>
          3. intent:// → Chrome (Android only)
        </button>
        <button style={btn} onClick={() => fire("x-safari-https", dest().replace(/^https?:/, "x-safari-https:"))}>
          4. x-safari-https:// (legacy)
        </button>
        <button style={btn} onClick={() => fire("googlechrome x-callback", "googlechrome://x-callback-url/open?url=" + encodeURIComponent(dest()))}>
          5. googlechrome://x-callback-url
        </button>
        <a
          style={{ ...btn, textDecoration: "none" }}
          href={mounted ? igScheme() : "#"}
          onClick={() => say("anchor href extbrowser tapped (native navigation, no JS)")}
        >
          6. plain &lt;a href=&quot;instagram://extbrowser&quot;&gt; anchor
        </a>
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
