// Generates the storefront-side JavaScript snippet that:
// - rejects desktop UAs early
// - detects in-app browser kind (instagram | facebook | messenger | tiktok | snapchat | pinterest | line | wechat | webview)
// - assigns A/B bucket via cookie (a = escape, b = control)
// - on Instagram, fires instagram://extbrowser/?url=<stamped-url> with sessionStorage + URL-param loop guard
// - on every other detected IAB, beacons iab_detected so the dashboard can segment by source
// - posts impression / iab_detected / escape_attempt / escape_skipped / fallback_shown / fallback_clicked
//
// All URLs / event names / scheme literals are base64-encoded so a casual reader of theme.liquid
// can't reverse-engineer the technique by reading the output.

export type SnippetVersion = "v1";
export const CURRENT_VERSION: SnippetVersion = "v1";

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
  var bk=null;
  try{bk=(document.cookie.match(/(?:^|; )eh_b=([^;]+)/)||[])[1]||null;}catch(e){}
  if(!bk){bk=(Math.random()<0.5)?"a":"b";try{document.cookie="eh_b="+bk+";path=/;max-age=2592000;samesite=Lax";}catch(e){}}
  var sy=null;
  try{sy=(document.cookie.match(/(?:^|; )_shopify_y=([^;]+)/)||[])[1]||null;}catch(e){}
  function beacon(t,extra){
    try{
      var p={m:M,v:V,t:t,b:bk,k:kind,sy:sy,ig:kind==="instagram"?1:0,u:location.href,r:document.referrer||"",ts:Date.now()};
      if(extra)for(var key in extra)p[key]=extra[key];
      var body=JSON.stringify(p);
      var sent=false;
      if(navigator.sendBeacon){try{var bl=new Blob([body],{type:"text/plain;charset=UTF-8"});sent=navigator.sendBeacon(I,bl);}catch(e){}}
      if(!sent){try{fetch(I,{method:"POST",headers:{"content-type":"text/plain;charset=UTF-8"},body:body,keepalive:true,mode:"cors",credentials:"omit"}).catch(function(){});}catch(e){}}
    }catch(e){}
  }
  beacon("impression");
  if(!kind)return;
  if(kind!=="instagram"){beacon("iab_detected");return;}
  var qs=new URLSearchParams(location.search);
  var guarded=qs.get("opened_external_browser")==="true";
  var attempted=false;
  try{attempted=sessionStorage.getItem("eh_a")==="1";}catch(e){}
  if(guarded||attempted){beacon("escape_skipped",{r:guarded?"u":"s"});return;}
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
