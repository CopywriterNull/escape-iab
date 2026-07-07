// Generates the storefront-side JavaScript snippet.
//
// Test population: visitors on merchant-enabled in-app browser surfaces.
// Default merchant config is Instagram only. Optional settings can enable
// Threads, Facebook, Messenger, and Discord coverage separately. For the
// Instagram baseline, detected by:
//   - UA matches /Instagram/  (inside IG's WebView), AND
//   - URL contains fbclid OR utm_source ∈ {facebook, instagram, fb, ig, meta}
//     with utm_medium ∈ {paid, cpc, ad} when paid_only is enabled
//
// Inside the test population, we 50/50 bucket (cookie eh_b):
//   - Bucket A: redirect to Safari/Chrome via instagram://extbrowser
//   - Bucket B: stay in IAB (control)
//
// Outside the test population, we exit silently — no bucketing, no events.
// (Exception: non-IG IABs get a single iab_detected beacon for analytics
// segmentation, but they're not in the bucketed test.)

export type SnippetVersion = "v7" | "v8" | "v9" | "v10";
export const CURRENT_VERSION: SnippetVersion = "v10";

type SnippetOpts = {
  merchantId: string;
  ingestUrl: string;
  version?: SnippetVersion;
  abEnabled?: boolean;
  fallbackButton?: boolean;
  escapeEnabled?: boolean;
  fallbackText?: string | null;
  paidOnly?: boolean;
  /** Percent of in-test traffic placed in bucket A (escape arm). 50 =
   *  legacy even split. Clamped to [1, 99] — 0 and 100 defeat the
   *  purpose of an A/B. */
  abSplitPct?: number;
  escapeInstagram?: boolean;
  escapeThreads?: boolean;
  escapeFacebook?: boolean;
  escapeMessenger?: boolean;
  escapeDiscord?: boolean;
  /** Hostname allowlist baked at compile time. Empty array = no restriction
   *  (F&F installs, dev). When populated, the snippet bails before any
   *  escape if location.hostname doesn't match an apex or any subdomain.
   *  localhost, 127.0.0.1, and *.vercel.app are always allowed. */
  allowedDomains?: string[];
};

/**
 * Parse merchant.domain from various formats into a normalized list of
 * apex hostnames for the snippet allowlist.
 *
 *   "andar.com"                    → ["andar.com"]
 *   "https://andar.com"            → ["andar.com"]
 *   "https://www.andar.com/"       → ["andar.com"]
 *   "andar.com, uk.andar.com"      → ["andar.com", "uk.andar.com"]
 *   "andar.com www.andar.com"      → ["andar.com"]   (dedup after www-strip)
 *   null / "" / not-a-domain       → []
 */
export function parseAllowedDomains(input: string | null | undefined): string[] {
  if (!input || typeof input !== "string") return [];
  const parts = input
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const raw of parts) {
    let host: string;
    try {
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      host = new URL(withScheme).hostname.toLowerCase();
    } catch {
      continue;
    }
    // Strip leading www. — universally meaningless. Keep other subdomains
    // intact (e.g. uk.andar.com stays uk.andar.com).
    host = host.replace(/^www\./, "");
    // Reject single-word garbage like "not", "domain". Every real public
    // hostname has at least one dot; this filters typos and stray words
    // that crept into the merchants.domain field.
    if (!host.includes(".")) continue;
    if (!out.includes(host)) out.push(host);
  }
  return out;
}

export function buildSnippet(opts: SnippetOpts): string {
  const merchantId = JSON.stringify(opts.merchantId);
  const ingestUrl = JSON.stringify(opts.ingestUrl);
  const version = JSON.stringify(opts.version ?? CURRENT_VERSION);
  const abEnabled = opts.abEnabled === true ? "true" : "false";
  const fallbackButton = opts.fallbackButton === false ? "false" : "true";
  // Kill-switch: when false, snippet still beacons impressions but skips
  // the actual redirect. Useful for pausing without uninstalling.
  const escapeEnabled = opts.escapeEnabled === false ? "false" : "true";
  // Custom fallback text — null/empty falls back to the base64-encoded default.
  const fallbackText = JSON.stringify(opts.fallbackText ?? "");
  // Paid-only gate: when true (default), only escape Meta IAB visitors
  // arriving via paid clicks. When false, escape any Meta IAB visitor
  // including organic IG link-in-bio / story / DM traffic.
  const paidOnly = opts.paidOnly === false ? "false" : "true";
  // A/B split percent (bucket A share). Defaults to 50 for legacy
  // behavior; clamped to [1, 99]. Bake the threshold (0.01–0.99) into
  // the snippet so terser can constant-fold for cheap dispatch.
  const rawSplit = typeof opts.abSplitPct === "number" ? opts.abSplitPct : 50;
  const clampedSplit = Math.min(99, Math.max(1, Math.round(rawSplit)));
  const splitThreshold = (clampedSplit / 100).toFixed(2); // string for embed
  const escapeInstagram = opts.escapeInstagram === false ? "false" : "true";
  const escapeThreads = opts.escapeThreads === true ? "true" : "false";
  const escapeFacebook = opts.escapeFacebook === true ? "true" : "false";
  const escapeMessenger = opts.escapeMessenger === true ? "true" : "false";
  const escapeDiscord = opts.escapeDiscord === true ? "true" : "false";
  // Allowed hostnames baked at compile time. Empty array = no restriction
  // (F&F installs and pre-domain merchants keep working).
  const allowedDomains = JSON.stringify(opts.allowedDomains ?? []);

  return `(function(){
try{
  var M=${merchantId},I=${ingestUrl},V=${version},AB=${abEnabled},FB=${fallbackButton},KE=${escapeEnabled},FT=${fallbackText},PO=${paidOnly},SPLIT=${splitThreshold},EI=${escapeInstagram},ET=${escapeThreads},EF=${escapeFacebook},EM=${escapeMessenger},ED=${escapeDiscord},AD=${allowedDomains};

  // Async kill-switch — if a prior /api/escape/status response in this
  // session marked us disabled, bail before doing anything. Lets inlined /
  // stolen snippets be remotely muted within one session of impression.
  try{if(sessionStorage.getItem("eh_dx")==="1")return;}catch(e){}

  // Hostname binding. When AD is populated, the snippet only fires on
  // hostnames in the allowlist (apex or any subdomain). Always allows
  // localhost, 127.0.0.1, and *.vercel.app so dev/preview keeps working.
  // We still send a single diagnostic beacon for visibility into stolen
  // copies in the wild before bailing.
  function HA(h){
    if(!AD||!AD.length)return 1;
    if(h==="localhost"||h==="127.0.0.1"||/\\.vercel\\.app$/i.test(h))return 1;
    for(var i=0;i<AD.length;i++){
      var d=AD[i];
      if(h===d||h.length>d.length+1&&h.charCodeAt(h.length-d.length-1)===46&&h.lastIndexOf(d)===h.length-d.length)return 1;
    }
    return 0;
  }
  if(!HA((location.hostname||"").toLowerCase())){
    // One-shot beacon with hr:1 so we can grep stolen-copy hostnames in
    // /api/track logs. Body is the bare minimum — no cookies, no kind,
    // no test population computation, no escape.
    try{
      var hrBody=JSON.stringify({m:M,v:V,t:"hostname_rejected",hr:1,u:location.href,ts:Date.now()});
      if(navigator.sendBeacon){try{navigator.sendBeacon(I,new Blob([hrBody],{type:"text/plain;charset=UTF-8"}));}catch(e){}}
    }catch(e){}
    return;
  }
  // Self-diagnostic: if our own <script> tag has async/defer, the redirect
  // path is structurally broken (IG webview paints before we run). Log a
  // visible warning so desktop QA catches it; stamp a flag on every beacon
  // so operators can see the misconfig in /api/track logs (look for as:1).
  var ASYNC=0;
  try{
    var sc=document.currentScript;
    if(sc&&(sc.async||sc.defer)){
      ASYNC=1;
      try{console.warn("[EscapeHatch] script loaded with async/defer — IG IAB redirect will be silently dropped. Remove the attribute from <script src=\\""+(sc.src||"")+"\\"></script>.");}catch(e){}
    }
  }catch(e){}
  var u=navigator.userAgent||"";
  if(!/Mobile|iPhone|iPod|iPad|Android/i.test(u))return;
  var kind=null;
  // Check Barcelona (Threads) BEFORE Instagram — Threads UAs contain both
  // tokens since Threads runs on IG's codebase.
  if(/Barcelona/i.test(u))kind="threads";
  else if(/Instagram/i.test(u))kind="instagram";
  else if(/FBAN|FBAV/i.test(u))kind=/Messenger/i.test(u)?"messenger":"facebook";
  else if(/Messenger/i.test(u))kind="messenger";
  else if(/TikTok|musical_ly/i.test(u))kind="tiktok";
  else if(/Snapchat/i.test(u))kind="snapchat";
  else if(/Pinterest/i.test(u))kind="pinterest";
  else if(/Discord/i.test(u))kind="discord";
  else if(/Line\\//i.test(u))kind="line";
  else if(/MicroMessenger/i.test(u))kind="wechat";
  else if(/(?:; wv\\)|; wv;|WebView)/i.test(u))kind="webview";

  // Discord: fire-and-forget escape. No bucketing, no analytics, no test
  // population pollution. Just try to bounce the visitor to a real browser.
  // Android: intent:// hands off to Chrome.
  // iOS: x-safari-https:// (broken on iOS 17.4+ but harmless when ignored).
  // sessionStorage guard prevents redirect loops if the OS rejects the scheme.
  if(kind==="discord"){
    if(!ED)return;
    var dcDone=false;
    try{dcDone=sessionStorage.getItem("eh_dc")==="1";}catch(e){}
    if(dcDone)return;
    try{sessionStorage.setItem("eh_dc","1");}catch(e){}
    try{
      if(/Android/i.test(u)){
        var iu="intent://"+location.host+location.pathname+location.search+
          "#Intent;scheme="+location.protocol.replace(":","")+
          ";package=com.android.chrome;S.browser_fallback_url="+
          encodeURIComponent(location.href)+";end";
        location.replace(iu);
      } else if(/iPhone|iPad|iPod/i.test(u)){
        location.replace(location.href.replace(/^https?:/,"x-safari-https:"));
      }
    }catch(e){}
    return;
  }

  var qsP=new URLSearchParams(location.search);
  var us=qsP.get("utm_source")||null,um=qsP.get("utm_medium")||null,uc=qsP.get("utm_campaign")||null,uct=qsP.get("utm_content")||null,ut=qsP.get("utm_term")||null,fc=qsP.get("fbclid")||null;
  // iOS Instagram strips the literal fbclid param on the extbrowser handoff to
  // Safari (utm_* and other params survive — only fbclid is removed by name).
  // We re-carry it below as eh_fbclid, which IG leaves untouched like our other
  // appended params. Read either name here so every beacon (and the post-escape
  // side) keeps the click id even after the strip.
  var ehfc=qsP.get("eh_fbclid")||null;if(!fc&&ehfc)fc=ehfc;
  // QA force flag: ?eh_force=a pins bucket A (escape fires regardless of
  // AB/PO/eh_a state). ?eh_force=b pins bucket B (silent-return, lets you
  // preview control behavior). Forced visits do NOT write the eh_b cookie
  // and stamp forced:1 on every beacon so dashboards can filter QA traffic.
  var ehForceRaw=qsP.get("eh_force");
  var FORCED=(ehForceRaw==="a"||ehForceRaw==="b")?1:0;
  var ehForce=FORCED?ehForceRaw:null;
  var paidSrc=us&&/^(facebook|instagram|fb|ig|meta)$/i.test(us);
  var paidMed=um&&/^(paid|cpc|ad)$/i.test(um);
  var isPaidAd=!!fc||(paidSrc&&paidMed);
  // postEscape: the visitor just escaped from IAB to Safari/Chrome. We stamped
  // opened_external_browser=true on the URL during the redirect. Safari has a
  // fresh _shopify_y cookie (different from IAB's), so we must record the
  // post-escape impression here too — otherwise pixel events fired on the
  // Safari side can't join back to a bucket-A impression.
  var postEscape=qsP.get("opened_external_browser")==="true";
  // Instagram and Threads both use the Meta extbrowser private scheme.
  // When PO (paid-only) is true, gate the test population on paid signal.
  // When false, escape any Meta IAB visitor (paid + organic).
  var isInstagramIAB=kind==="instagram";
  var isThreadsIAB=kind==="threads";
  var isMetaIAB=(isInstagramIAB||isThreadsIAB);
  var enabledMetaIAB=(isInstagramIAB&&EI)||(isThreadsIAB&&ET);
  // FORCED bypasses the paid_only gate so QA testers without paid UTMs
  // still land in the test population. Still requires being inside an IG
  // or Threads webview — the scheme handoff only works there.
  var inTest=(enabledMetaIAB&&(FORCED||!PO||isPaidAd))||postEscape;

  function readSy(){try{return(document.cookie.match(/(?:^|; )_shopify_y=([^;]+)/)||[])[1]||null;}catch(e){return null;}}
  var sy=readSy();

  // eh_sid: our own persistent visitor ID. Survives the Shopify checkout
  // cookie-jar break (Shop Pay subdomain, new checkout extensibility) where
  // _shopify_y changes mid-flow. Carried via URL on escape, cookie for
  // future visits, and Shopify cart attributes for pixel attribution.
  function ehGen(){
    try{if(crypto&&crypto.randomUUID)return crypto.randomUUID();}catch(e){}
    var s="";for(var i=0;i<32;i++)s+=Math.floor(Math.random()*16).toString(16);
    return s.slice(0,8)+"-"+s.slice(8,12)+"-4"+s.slice(13,16)+"-a"+s.slice(17,20)+"-"+s.slice(20,32);
  }
  var sid=qsP.get("eh_sid")||null;
  if(!sid){try{sid=(document.cookie.match(/(?:^|; )eh_sid=([^;]+)/)||[])[1]||null;}catch(e){}}
  if(!sid)sid=ehGen();
  try{document.cookie="eh_sid="+sid+";path=/;max-age=2592000;samesite=Lax";}catch(e){}

  function beacon(t,extra){
    try{
      var p={m:M,v:V,t:t,b:bk||"",k:kind,sy:sy,sid:sid,ig:isMetaIAB?1:0,it:inTest?1:0,as:ASYNC,forced:FORCED,u:location.href,r:document.referrer||"",us:us,um:um,uc:uc,uct:uct,ut:ut,fc:fc,ts:Date.now()};
      if(extra)for(var key in extra)p[key]=extra[key];
      var body=JSON.stringify(p);
      var sent=false;
      if(navigator.sendBeacon){try{var bl=new Blob([body],{type:"text/plain;charset=UTF-8"});sent=navigator.sendBeacon(I,bl);}catch(e){}}
      if(!sent){try{fetch(I,{method:"POST",headers:{"content-type":"text/plain;charset=UTF-8"},body:body,keepalive:true,mode:"cors",credentials:"omit"}).catch(function(){});}catch(e){}}
      // Piggyback the kill-check on every impression beacon. Fail-open: if
      // /api/escape/status is down, the escape still fires (the redirect
      // doesn't wait for this). If the merchant is disabled, the snippet
      // sets eh_dx in sessionStorage and subsequent visits this session
      // bail at the early check at the top. This is the only remote-kill
      // path for inlined / stolen snippets.
      if(t==="impression"){
        try{
          var su=I.replace(/\\/api\\/track$/,"/api/escape/status")+"?m="+encodeURIComponent(M);
          fetch(su,{mode:"cors",credentials:"omit",keepalive:true})
            .then(function(r){return r&&r.ok?r.json():null;})
            .then(function(d){
              if(d&&d.disabled){
                try{sessionStorage.setItem("eh_dx","1");}catch(e){}
              }
            }).catch(function(){});
        }catch(e){}
      }
    }catch(e){}
  }

  // Wait up to maxMs for _shopify_y cookie to appear (set by Shopify's
  // Web Pixels Manager). Critical for attribution: if we beacon impression
  // before the cookie exists, sy=null and the funnel pixel can't join back.
  function waitForSy(maxMs,cb){
    var start=Date.now();
    function tick(){
      var v=readSy();
      if(v){sy=v;cb();return;}
      if(Date.now()-start>=maxMs){cb();return;}
      setTimeout(tick,40);
    }
    tick();
  }

  var bk=null;

  // ─── Facebook / Messenger escape ─────────────────────────────────────
  // FB has no extbrowser private scheme on iOS. We render a full-screen
  // press-and-hold splash so iOS' native long-press menu hands off to
  // Safari. Android uses intent:// to Chrome (works programmatically).
  if(kind==="facebook"||kind==="messenger"){
    var fbEnabled=(kind==="facebook"&&EF)||(kind==="messenger"&&EM);
    if(!fbEnabled){beacon("iab_detected");return;}
    if(postEscape){beacon("impression");return;}
    if(!FORCED){try{if(sessionStorage.getItem("eh_fb")==="1"){beacon("escape_skipped",{r:"f"});return;}}catch(e){}}
    if(PO&&!isPaidAd&&!FORCED){beacon("iab_detected");return;}
    if(!KE&&!FORCED){beacon("escape_skipped",{r:"k"});return;}

    if(FORCED){bk=ehForce;}
    else if(!AB){bk="a";try{document.cookie="eh_b=a;path=/;max-age=2592000;samesite=Lax";}catch(e){}}
    else{
      try{bk=(document.cookie.match(/(?:^|; )eh_b=([^;]+)/)||[])[1]||null;}catch(e){}
      if(!bk){bk=(Math.random()<SPLIT)?"a":"b";try{document.cookie="eh_b="+bk+";path=/;max-age=2592000;samesite=Lax";}catch(e){}}
    }
    beacon("impression");
    // FORCED treats "b" as silent-return regardless of AB toggle, so QA
    // can preview control behavior even with AB off.
    if((AB||FORCED)&&bk==="b")return;

    var fbDest=location.href;
    try{
      var fbu=new URL(location.href);
      fbu.searchParams.set("opened_external_browser","true");
      fbu.searchParams.set("source_browser","facebook_in_app");
      fbu.searchParams.set("eh_sid",sid);
      fbu.searchParams.set("eh_escape","1");
      if(fc)fbu.searchParams.set("eh_fbclid",fc);
      fbDest=fbu.toString();
    }catch(e){}
    if(!FORCED){try{sessionStorage.setItem("eh_fb","1");}catch(e){}}
    beacon("escape_attempt");

    if(/Android/i.test(u)){
      try{
        var fpu=new URL(fbDest);
        var fiu="intent://"+fpu.host+fpu.pathname+fpu.search+"#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url="+encodeURIComponent(fbDest)+";end";
        setTimeout(function(){try{location.replace(fiu);}catch(e){location.href=fiu;}},60);
      }catch(e){}
      return;
    }

    if(/iPhone|iPad|iPod/i.test(u)){
      document.addEventListener("DOMContentLoaded",function(){
        try{
          var ov=document.createElement("div");
          ov.style.position="fixed";
          ov.style.inset="0";
          ov.style.background="#fafafa";
          ov.style.zIndex="2147483647";
          ov.style.display="flex";
          ov.style.flexDirection="column";
          ov.style.alignItems="center";
          ov.style.justifyContent="center";
          ov.style.padding="40px";
          ov.style.fontFamily="-apple-system,BlinkMacSystemFont,system-ui,sans-serif";
          var hd=document.createElement("h2");
          hd.textContent="Open in your browser";
          hd.style.fontSize="22px";
          hd.style.fontWeight="600";
          hd.style.color="#09090b";
          hd.style.margin="0 0 20px 0";
          hd.style.textAlign="center";
          var bt=document.createElement("a");
          bt.href=fbDest;
          bt.textContent="Continue";
          bt.style.display="block";
          bt.style.background="#09090b";
          bt.style.color="#fafafa";
          bt.style.padding="16px 56px";
          bt.style.borderRadius="999px";
          bt.style.fontWeight="600";
          bt.style.fontSize="17px";
          bt.style.textDecoration="none";
          bt.style.marginBottom="24px";
          bt.style.boxShadow="0 10px 28px rgba(0,0,0,0.20)";
          bt.addEventListener("click",function(e){e.preventDefault();beacon("fallback_clicked");});
          var hi=document.createElement("p");
          hi.textContent="Press and hold the button above, then tap \\"Open in Safari\\" or \\"Open in Chrome\\".";
          hi.style.fontSize="13.5px";
          hi.style.color="#52525b";
          hi.style.textAlign="center";
          hi.style.maxWidth="320px";
          hi.style.lineHeight="1.5";
          hi.style.margin="0";
          ov.appendChild(hd);
          ov.appendChild(bt);
          ov.appendChild(hi);
          document.body.appendChild(ov);
          beacon("fallback_shown");
        }catch(e){}
      });
      return;
    }
    return;
  }
  // ─── End FB/Messenger ────────────────────────────────────────────────

  // Only bucket + impression for the test population. Non-test traffic exits silently
  // (or beacons iab_detected for non-IG IAB analytics).
  if(!inTest){
    if(kind&&kind!=="instagram"){
      try{bk=(document.cookie.match(/(?:^|; )eh_b=([^;]+)/)||[])[1]||null;}catch(e){}
      beacon("iab_detected");
    }
    return;
  }

  // FORCED pins bucket from the URL flag without writing the eh_b cookie,
  // so QA traffic doesn't permanently bucket the tester's device.
  if(FORCED){bk=ehForce;}
  else if(!AB){bk="a";try{document.cookie="eh_b=a;path=/;max-age=2592000;samesite=Lax";}catch(e){}}
  else{
    try{bk=(document.cookie.match(/(?:^|; )eh_b=([^;]+)/)||[])[1]||null;}catch(e){}
    // Post-escape Safari side: force bucket A (we know this visitor was escaped
    // from bucket A in the IAB; we don't want to randomly re-bucket them).
    if(postEscape){bk="a";try{document.cookie="eh_b=a;path=/;max-age=2592000;samesite=Lax";}catch(e){}}
    else if(!bk){bk=(Math.random()<SPLIT)?"a":"b";try{document.cookie="eh_b="+bk+";path=/;max-age=2592000;samesite=Lax";}catch(e){}}
  }

  // Touch the Shopify cart: write eh_sid attribute AND capture cart_token.
  // cart_token is the ONLY identifier that survives every Shopify checkout flow
  // (Shop Pay, Apple Pay, returning customers, subscriptions). It's the
  // primary join key for purchase attribution. The webhook reads
  // order.cart_token and joins to the impression with the same value.
  // The eh_sid attribute is a secondary join key in case cart_token rotates.
  function touchCart(){
    try{
      fetch("/cart/update.json",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({attributes:{eh_sid:sid}}),credentials:"same-origin"})
        .then(function(){return fetch("/cart.json",{credentials:"same-origin"});})
        .then(function(r){return r.ok?r.json():null;})
        .then(function(c){
          if(!c)return;
          var ok=0;
          try{
            if(c.attributes){
              var a=c.attributes;
              if(Array.isArray(a)){for(var i=0;i<a.length;i++){if(a[i]&&a[i].name==="eh_sid"&&a[i].value===sid){ok=1;break;}}}
              else if(typeof a==="object"&&a.eh_sid===sid){ok=1;}
            }
          }catch(e){}
          var ct=c.token||null;
          beacon("cart_check",{ck:ok,ct:ct});
        })
        .catch(function(){beacon("cart_check",{ck:0});});
    }catch(e){}
  }
  function writeCartAttr(){touchCart();}

  // Restore the fbclid that iOS Instagram stripped on the handoff. We carried
  // it through as eh_fbclid; put it back on the URL so the merchant's own Meta
  // pixel reads it and attributes the conversion. This snippet is first and
  // synchronous in <head>, so replaceState runs before the pixel initializes.
  // history API only — no reload. Covers IG/Threads and FB escapes (all land
  // in Safari with kind=null and reach this point).
  if(postEscape&&ehfc){try{if(location.search.indexOf("fbclid=")===-1){var ru=new URL(location.href);ru.searchParams.set("fbclid",ehfc);history.replaceState(null,"",ru.toString());}}catch(e){}}

  // Post-escape Safari side: no escape urgency. Wait up to 1.5s for sy cookie
  // before beaconing the impression so the funnel pixel can join back.
  if(postEscape){
    waitForSy(1500,function(){beacon("impression");writeCartAttr();});
    return;
  }

  // IAB side: beacon impression with whatever sy we have (likely null on first
  // pageview), then proceed with escape logic. Don't delay escape.
  beacon("impression");
  writeCartAttr();

  var attempted=false;
  try{attempted=sessionStorage.getItem("eh_a")==="1";}catch(e){}
  // FORCED bypasses every silent-exit so the tester can re-fire the
  // redirect repeatedly. Bucket-B is the one exception below: force-b is
  // the documented way to preview control, so we honor it.
  if(attempted&&!FORCED){beacon("escape_skipped",{r:"s"});return;}
  if((AB||FORCED)&&bk==="b")return;
  // Kill switch: skip the redirect entirely but keep tracking (impression
  // already fired above, so we still see traffic + the test population).
  if(!KE&&!FORCED){beacon("escape_skipped",{r:"k"});return;}

  var dest=location.href;
  try{var nu=new URL(location.href);nu.searchParams.set("opened_external_browser","true");nu.searchParams.set("source_browser","instagram_in_app");nu.searchParams.set("eh_sid",sid);nu.searchParams.set("eh_escape","1");if(fc)nu.searchParams.set("eh_fbclid",fc);dest=nu.toString();}catch(e){}
  // Threads uses barcelona://extbrowser/?url= ; Instagram uses instagram://
  // Both schemes accept identical payloads and hand off to system default.
  var schemePrefix=kind==="threads"
    ?atob("YmFyY2Vsb25hOi8vZXh0YnJvd3Nlci8/dXJsPQ==")
    :atob("aW5zdGFncmFtOi8vZXh0YnJvd3Nlci8/dXJsPQ==");
  var s=schemePrefix+encodeURIComponent(dest);
  // Don't write the sticky eh_a flag for forced QA visits so the tester
  // can refresh and re-trigger the redirect without clearing storage.
  if(!FORCED){try{sessionStorage.setItem("eh_a","1");}catch(e){}}
  beacon("escape_attempt");
  setTimeout(function(){try{location.replace(s);}catch(e){location.href=s;}},60);

  // Visibility polling — if the OS opened our scheme, the page goes hidden.
  // Poll document.hidden at three intervals; any positive hit marks the
  // escape as succeeded so the fallback button doesn't paint on top of a
  // user who's already in Safari/Chrome.
  var escaped=false;
  function probeH(){if(document.hidden)escaped=true;}
  setTimeout(probeH,120);
  setTimeout(probeH,380);
  setTimeout(probeH,760);
  try{document.addEventListener("visibilitychange",function(){if(document.hidden)escaped=true;});}catch(e){}

  if(FB){
    document.addEventListener("DOMContentLoaded",function(){
      setTimeout(function(){
        if(escaped)return;
        try{
          var b=document.createElement("a");
          b.href=s;
          b.textContent=FT||atob("dGFwIHRvIG9wZW4gaW4gYnJvd3Nlcg==");
          b.setAttribute("style","position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#fff;color:#000;padding:12px 22px;border-radius:999px;font-weight:700;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;text-decoration:none;box-shadow:0 10px 28px rgba(0,0,0,.55);");
          b.addEventListener("click",function(){beacon("fallback_clicked");});
          document.body.appendChild(b);
          beacon("fallback_shown");
        }catch(e){}
      },2000);
    });
  }
}catch(e){}
})();`;
}
