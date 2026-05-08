// Generates the storefront-side JavaScript snippet.
//
// Test population: visitors who landed via a paid Meta ad (Facebook or
// Instagram) inside the Instagram in-app browser. Detected by:
//   - UA matches /Instagram/  (we're inside IG's WebView), AND
//   - URL contains fbclid OR utm_source ∈ {facebook, instagram, fb, ig, meta}
//     with utm_medium ∈ {paid, cpc, ad}
//
// Inside the test population, we 50/50 bucket (cookie eh_b):
//   - Bucket A: redirect to Safari/Chrome via instagram://extbrowser
//   - Bucket B: stay in IAB (control)
//
// Outside the test population, we exit silently — no bucketing, no events.
// (Exception: non-IG IABs get a single iab_detected beacon for analytics
// segmentation, but they're not in the bucketed test.)

export type SnippetVersion = "v4";
export const CURRENT_VERSION: SnippetVersion = "v4";

type SnippetOpts = {
  merchantId: string;
  ingestUrl: string;
  version?: SnippetVersion;
  abEnabled?: boolean;
  fallbackButton?: boolean;
};

export function buildSnippet(opts: SnippetOpts): string {
  const merchantId = JSON.stringify(opts.merchantId);
  const ingestUrl = JSON.stringify(opts.ingestUrl);
  const version = JSON.stringify(opts.version ?? CURRENT_VERSION);
  const abEnabled = opts.abEnabled === true ? "true" : "false";
  const fallbackButton = opts.fallbackButton === false ? "false" : "true";

  return `(function(){
try{
  var M=${merchantId},I=${ingestUrl},V=${version},AB=${abEnabled},FB=${fallbackButton};
  var u=navigator.userAgent||"";
  if(!/Mobile|iPhone|iPod|iPad|Android/i.test(u))return;
  var kind=null;
  if(/Instagram/i.test(u))kind="instagram";
  else if(/FBAN|FBAV/i.test(u))kind=/Messenger/i.test(u)?"messenger":"facebook";
  else if(/Messenger/i.test(u))kind="messenger";
  else if(/TikTok|musical_ly/i.test(u))kind="tiktok";
  else if(/Snapchat/i.test(u))kind="snapchat";
  else if(/Pinterest/i.test(u))kind="pinterest";
  else if(/Line\\//i.test(u))kind="line";
  else if(/MicroMessenger/i.test(u))kind="wechat";
  else if(/(?:; wv\\)|; wv;|WebView)/i.test(u))kind="webview";

  var qsP=new URLSearchParams(location.search);
  var us=qsP.get("utm_source")||null,um=qsP.get("utm_medium")||null,uc=qsP.get("utm_campaign")||null,uct=qsP.get("utm_content")||null,ut=qsP.get("utm_term")||null,fc=qsP.get("fbclid")||null;
  var paidSrc=us&&/^(facebook|instagram|fb|ig|meta)$/i.test(us);
  var paidMed=um&&/^(paid|cpc|ad)$/i.test(um);
  var isPaidAd=!!fc||(paidSrc&&paidMed);
  // postEscape: the visitor just escaped from IAB to Safari/Chrome. We stamped
  // opened_external_browser=true on the URL during the redirect. Safari has a
  // fresh _shopify_y cookie (different from IAB's), so we must record the
  // post-escape impression here too — otherwise pixel events fired on the
  // Safari side can't join back to a bucket-A impression.
  var postEscape=qsP.get("opened_external_browser")==="true";
  var inTest=((kind==="instagram")&&isPaidAd)||postEscape;

  function readSy(){try{return(document.cookie.match(/(?:^|; )_shopify_y=([^;]+)/)||[])[1]||null;}catch(e){return null;}}
  var sy=readSy();

  function beacon(t,extra){
    try{
      var p={m:M,v:V,t:t,b:bk||"",k:kind,sy:sy,ig:kind==="instagram"?1:0,it:inTest?1:0,u:location.href,r:document.referrer||"",us:us,um:um,uc:uc,uct:uct,ut:ut,fc:fc,ts:Date.now()};
      if(extra)for(var key in extra)p[key]=extra[key];
      var body=JSON.stringify(p);
      var sent=false;
      if(navigator.sendBeacon){try{var bl=new Blob([body],{type:"text/plain;charset=UTF-8"});sent=navigator.sendBeacon(I,bl);}catch(e){}}
      if(!sent){try{fetch(I,{method:"POST",headers:{"content-type":"text/plain;charset=UTF-8"},body:body,keepalive:true,mode:"cors",credentials:"omit"}).catch(function(){});}catch(e){}}
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
  // Only bucket + impression for the test population. Non-test traffic exits silently
  // (or beacons iab_detected for non-IG IAB analytics).
  if(!inTest){
    if(kind&&kind!=="instagram"){
      try{bk=(document.cookie.match(/(?:^|; )eh_b=([^;]+)/)||[])[1]||null;}catch(e){}
      beacon("iab_detected");
    }
    return;
  }

  try{bk=(document.cookie.match(/(?:^|; )eh_b=([^;]+)/)||[])[1]||null;}catch(e){}
  // Post-escape Safari side: force bucket A (we know this visitor was escaped
  // from bucket A in the IAB; we don't want to randomly re-bucket them).
  if(postEscape){bk="a";try{document.cookie="eh_b=a;path=/;max-age=2592000;samesite=Lax";}catch(e){}}
  else if(!bk){bk=(Math.random()<0.5)?"a":"b";try{document.cookie="eh_b="+bk+";path=/;max-age=2592000;samesite=Lax";}catch(e){}}

  // Post-escape Safari side: no escape urgency. Wait up to 1.5s for sy cookie
  // before beaconing the impression so the funnel pixel can join back.
  if(postEscape){
    waitForSy(1500,function(){beacon("impression");});
    return;
  }

  // IAB side: beacon impression with whatever sy we have (likely null on first
  // pageview), then proceed with escape logic. Don't delay escape.
  beacon("impression");

  var attempted=false;
  try{attempted=sessionStorage.getItem("eh_a")==="1";}catch(e){}
  if(attempted){beacon("escape_skipped",{r:"s"});return;}
  if(AB&&bk==="b")return;

  var dest=location.href;
  try{var nu=new URL(location.href);nu.searchParams.set("opened_external_browser","true");nu.searchParams.set("source_browser","instagram_in_app");dest=nu.toString();}catch(e){}
  var s=atob("aW5zdGFncmFtOi8vZXh0YnJvd3Nlci8/dXJsPQ==")+encodeURIComponent(dest);
  try{sessionStorage.setItem("eh_a","1");}catch(e){}
  beacon("escape_attempt");
  setTimeout(function(){try{location.replace(s);}catch(e){location.href=s;}},60);

  if(FB){
    document.addEventListener("DOMContentLoaded",function(){
      setTimeout(function(){
        try{
          var b=document.createElement("a");
          b.href=s;
          b.textContent=atob("dGFwIHRvIG9wZW4gaW4gYnJvd3Nlcg==");
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
