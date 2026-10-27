// Declarative-escape lab. A meta refresh to extbrowser is reportedly honoured
// while the page is still parsing (no gesture needed to raise IG's consent
// sheet), unlike JS-fired location.replace which is dropped. That only works
// from the initial HTML, so this is a raw route handler, not a client page.
//
// Variants (?v=): meta (tag in served HTML), docwrite (sync head script writes
// the tag, i.e. what the snippet could do), chrome (meta → googlechrome(s)://).
// Open inside Instagram/Threads: DM yourself https://getescapehatch.com/lab/meta

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function GET(req: Request) {
  const url = new URL(req.url);
  const v = url.searchParams.get("v") || "meta";
  const ua = req.headers.get("user-agent") || "";
  const inIab = /Instagram|Barcelona/i.test(ua);
  const arm = inIab || url.searchParams.get("force") === "1";

  const dest = new URL("/lab", url.origin);
  dest.searchParams.set("escaped", "1");
  dest.searchParams.set("via", "meta-" + v);
  dest.searchParams.set("opened_external_browser", "true");
  dest.searchParams.set("utm_source", "instagram");
  dest.searchParams.set("eh_fbclid", "IwTESTCLICKID123");

  const target =
    v === "chrome"
      ? dest.toString().replace(/^http(s?):/, "googlechrome$1:")
      : (/Barcelona/i.test(ua) ? "barcelona" : "instagram") +
        "://extbrowser/?url=" + encodeURIComponent(dest.toString());

  const refresh = `<meta http-equiv="refresh" content="0;url=${esc(target)}">`;
  const head = !arm
    ? ""
    : v === "docwrite"
      ? `<script>document.write(${JSON.stringify(refresh)})</script>`
      : refresh;

  const variants = ["meta", "docwrite", "chrome"]
    .map((x) => `<a href="/lab/meta?v=${x}&t=${Date.now()}"${x === v ? ' class="on"' : ""}>${x}</a>`)
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${head}
<title>EH lab · meta refresh</title><meta name="robots" content="noindex">
<style>body{margin:0;padding:20px 16px;background:#0b0b0c;color:#eee;font:15px/1.45 -apple-system,system-ui,sans-serif}
a{display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:999px;background:#222;color:#fff;text-decoration:none;font-weight:600}
a.on{background:#fff;color:#000}#log{margin-top:16px;padding:12px;background:#151517;border-radius:10px;font:12px/1.6 ui-monospace,monospace;white-space:pre-wrap}
.k{opacity:.55}</style></head><body>
<h2 style="margin:0 0 6px">meta refresh lab</h2>
<div class="k">variant <b>${esc(v)}</b> · ${arm ? "armed" : "NOT armed (not in IG/Threads; add &amp;force=1)"}</div>
<div class="k" style="word-break:break-all;margin:6px 0 14px">${esc(target)}</div>
<div>${variants}</div>
<a href="${esc(target)}" style="background:#a7f3d0;color:#000">tap fallback (same target)</a>
<div id="log"></div>
<p class="k">Pass = IG's sheet appears on load with no tap on this page, then "Open" lands on /lab?escaped=1. Note: no events fire while the sheet is up, so silence here is expected until you choose.</p>
<script>
var t0=Date.now(),L=document.getElementById("log");
function say(m){L.textContent+="+"+(Date.now()-t0)+"ms "+m+"\\n";}
say("ua "+navigator.userAgent.slice(-60));
["visibilitychange","pagehide","pageshow","blur","focus"].forEach(function(e){(e==="visibilitychange"?document:window).addEventListener(e,function(){say(e+(e==="visibilitychange"?" hidden="+document.hidden:""));});});
var last=Date.now();setInterval(function(){var n=Date.now();if(n-last>900)say("timer drift "+(n-last)+"ms (backgrounded or sheet)");last=n;},250);
</script></body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store, max-age=0" },
  });
}
