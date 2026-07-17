import { describe, it, expect } from "vitest";
import { buildSnippet } from "./snippet";

const IG_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0.0.0";

type RunResult = { replaceStateUrls: string[]; escapeUrls: string[] };

/**
 * Execute the compiled snippet inside a minimal mocked in-app-browser
 * environment and capture every history.replaceState + location.replace URL.
 * setTimeout is a no-op so the async escape redirect never fires — tagUtm()
 * runs synchronously before it, which is exactly what we're asserting.
 */
function runSnippet(opts: {
  utmTagging?: boolean;
  url: string;
  ua?: string;
  paidOnly?: boolean;
  abEnabled?: boolean;
  escapeFacebook?: boolean;
}): RunResult {
  const snippet = buildSnippet({
    merchantId: "11111111-1111-4111-8111-111111111111",
    ingestUrl: "https://ex.com/api/track",
    utmTagging: opts.utmTagging,
    paidOnly: opts.paidOnly ?? false,
    abEnabled: opts.abEnabled ?? true,
    escapeFacebook: opts.escapeFacebook,
  });

  const replaceStateUrls: string[] = [];
  const escapeUrls: string[] = [];

  // Mutable current URL — replaceState updates it so later new URL(location.href)
  // reads reflect the rewrite (mirrors real browser behavior).
  let current = new URL(opts.url);
  const location = {
    get href() {
      return current.toString();
    },
    set href(v: string) {
      current = new URL(v);
    },
    get search() {
      return current.search;
    },
    get hostname() {
      return current.hostname;
    },
    get host() {
      return current.host;
    },
    get pathname() {
      return current.pathname;
    },
    get protocol() {
      return current.protocol;
    },
    replace(u: string) {
      escapeUrls.push(u);
    },
  };

  const cookieJar: Record<string, string> = {};
  const document = {
    get cookie() {
      return Object.entries(cookieJar)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
    set cookie(v: string) {
      const [pair] = v.split(";");
      const idx = pair.indexOf("=");
      cookieJar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    },
    currentScript: null,
    hidden: false,
    addEventListener() {},
    createElement() {
      return { style: {}, setAttribute() {}, addEventListener() {}, appendChild() {} };
    },
    body: { appendChild() {} },
  };

  const history = {
    replaceState(_s: unknown, _t: string, u: string) {
      replaceStateUrls.push(u);
      current = new URL(u);
    },
  };

  const navigator = {
    userAgent: opts.ua ?? IG_UA,
    sendBeacon: () => true,
  };
  const sessionStorage = {
    _m: {} as Record<string, string>,
    getItem(k: string) {
      return this._m[k] ?? null;
    },
    setItem(k: string, v: string) {
      this._m[k] = v;
    },
  };
  const fetchMock = () => Promise.resolve(null);
  // Run timer callbacks synchronously so the deferred escape (location.replace,
  // scheduled via setTimeout after tagUtm) actually fires and we can capture it.
  // Safe here: no postEscape waitForSy polling loop is reached in these cases.
  const syncTimer = (cb: unknown) => {
    if (typeof cb === "function") (cb as () => void)();
    return 0;
  };

  const fn = new Function(
    "navigator",
    "location",
    "document",
    "history",
    "sessionStorage",
    "fetch",
    "setTimeout",
    "Blob",
    snippet,
  );
  fn(navigator, location, document, history, sessionStorage, fetchMock, syncTimer, class {});

  return { replaceStateUrls, escapeUrls };
}

function utmTermOf(url: string): string | null {
  return new URL(url).searchParams.get("utm_term");
}

describe("snippet behavior: utm_term A/B tagging", () => {
  it("stamps escapehatch-a when forced into bucket A", () => {
    const { replaceStateUrls } = runSnippet({
      utmTagging: true,
      url: "https://shop.com/product?eh_force=a",
    });
    const tagged = replaceStateUrls.map(utmTermOf).filter(Boolean);
    expect(tagged).toContain("escapehatch-a");
  });

  it("stamps escapehatch-b when forced into bucket B", () => {
    const { replaceStateUrls } = runSnippet({
      utmTagging: true,
      url: "https://shop.com/product?eh_force=b",
    });
    const tagged = replaceStateUrls.map(utmTermOf).filter(Boolean);
    expect(tagged).toContain("escapehatch-b");
  });

  it("the escape destination URL carries the tag into Safari (bucket A)", () => {
    const { escapeUrls } = runSnippet({
      utmTagging: true,
      url: "https://shop.com/product?eh_force=a",
    });
    // Escape URL is instagram://extbrowser/?url=<encoded dest>. Decode and check.
    const withTag = escapeUrls.some((u) => decodeURIComponent(u).includes("utm_term=escapehatch-a"));
    expect(withTag).toBe(true);
  });

  it("never overwrites an existing utm_term (only-if-absent)", () => {
    const { replaceStateUrls } = runSnippet({
      utmTagging: true,
      url: "https://shop.com/product?eh_force=a&utm_term=brand_kw",
    });
    const overwritten = replaceStateUrls.some((u) => utmTermOf(u) === "escapehatch-a");
    expect(overwritten).toBe(false);
  });

  it("also tags on the Facebook in-app-browser path", () => {
    const FB_UA =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0]";
    const { replaceStateUrls } = runSnippet({
      utmTagging: true,
      escapeFacebook: true,
      ua: FB_UA,
      url: "https://shop.com/product?eh_force=a",
    });
    const tagged = replaceStateUrls.map(utmTermOf).filter(Boolean);
    expect(tagged).toContain("escapehatch-a");
  });

  it("does not tag at all when utmTagging is disabled", () => {
    const { replaceStateUrls } = runSnippet({
      utmTagging: false,
      url: "https://shop.com/product?eh_force=a",
    });
    const tagged = replaceStateUrls.some((u) => (utmTermOf(u) ?? "").startsWith("escapehatch-"));
    expect(tagged).toBe(false);
  });
});
