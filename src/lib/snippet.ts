// Generates the storefront-side JavaScript snippet that:
// - detects Instagram in-app browser via UA
// - assigns user to A/B bucket (control vs escape) and persists in cookie
// - escapes via instagram://extbrowser/?url=... if in escape bucket
// - posts impression / escape / fallback events to /api/track
//
// We keep ALL minified inline so the entire snippet is one file the merchant
// installs. The merchantId is baked into the URL of the snippet endpoint;
// the snippet itself reads it back via document.currentScript or a window flag
// passed by the host script tag.

export type SnippetVersion = "v1";
export const CURRENT_VERSION: SnippetVersion = "v1";

type SnippetOpts = {
  merchantId: string;
  ingestUrl: string;
  version?: SnippetVersion;
  // When true, control bucket disables redirect (used for live A/B).
  abEnabled?: boolean;
  // When true, render the link.me-style 2s fallback button.
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
  var isIG=/Instagram/i.test(u);
  var bk=null;
  try{bk=(document.cookie.match(/(?:^|; )eh_b=([^;]+)/)||[])[1]||null;}catch(e){}
  if(!bk){bk=(Math.random()<0.5)?"a":"b";try{document.cookie="eh_b="+bk+";path=/;max-age=2592000;samesite=Lax";}catch(e){}}
  var doEscape=isIG&&(!AB||bk==="a");
  function beacon(t,extra){
    try{
      var p={m:M,v:V,t:t,b:bk,ig:isIG?1:0,u:location.href,r:document.referrer||"",ts:Date.now()};
      if(extra)for(var k in extra)p[k]=extra[k];
      var body=JSON.stringify(p);
      if(navigator.sendBeacon){var bl=new Blob([body],{type:"application/json"});navigator.sendBeacon(I,bl);}
      else{var x=new XMLHttpRequest();x.open("POST",I,true);x.setAttribute("content-type","application/json");x.send(body);}
    }catch(e){}
  }
  beacon("impression");
  if(!doEscape)return;
  var s=atob("aW5zdGFncmFtOi8vZXh0YnJvd3Nlci8/dXJsPQ==")+encodeURIComponent(location.href);
  beacon("escape_attempt");
  try{location.replace(s);}catch(e){location.href=s;}
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
