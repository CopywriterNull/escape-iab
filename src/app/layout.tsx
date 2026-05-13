import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { brand } from "@/lib/branding";
import { themeBootScript } from "@/components/magic/ThemeToggle";
import "./globals.css";

// Eat our own dog food: any IG / Threads in-app browser visitor who lands
// on the marketing site gets auto-escaped to Safari before they see our
// hero. No paid-ad gate (organic IG shares are how most people would
// discover us), Threads supported, fallback button after 2s if iOS rejects
// the scheme. Loop guards via URL marker + sessionStorage. No analytics
// roundtrip — this is just a courtesy escape for visitors, not a tracked
// merchant install.
const igEscapeScript = `
(function(){try{
  // Paranoia: this self-escape inline script is bundled into the Next.js
  // app's <head>, which only ever ships on our own pages — but in case
  // anyone ever embeds our HTML elsewhere, hard-gate on hostname.
  var h=(location.hostname||"").toLowerCase();
  var OK=h==="getescapehatch.com"||h==="www.getescapehatch.com"||h==="escapethebrowser.com"||h==="www.escapethebrowser.com"||h==="escape-iab.vercel.app"||h.endsWith(".vercel.app");
  if(!OK)return;
  var u=navigator.userAgent||"";
  if(!/iPhone|iPad|iPod|Android/i.test(u))return;
  var isThreads=/Barcelona/i.test(u);
  if(!isThreads && !/Instagram/i.test(u))return;
  var q=new URLSearchParams(location.search);
  if(q.get("opened_external_browser")==="true")return;
  try{if(sessionStorage.getItem("eh_self")==="1")return;}catch(e){}
  var url=new URL(location.href);
  url.searchParams.set("opened_external_browser","true");
  var dest=url.toString();
  var scheme=isThreads?"barcelona://extbrowser/?url=":"instagram://extbrowser/?url=";
  var target=scheme+encodeURIComponent(dest);
  try{sessionStorage.setItem("eh_self","1");}catch(e){}
  setTimeout(function(){try{location.replace(target);}catch(e){location.href=target;}},60);
  var escaped=false;
  function probe(){if(document.hidden)escaped=true;}
  setTimeout(probe,120);setTimeout(probe,380);setTimeout(probe,760);
  try{document.addEventListener("visibilitychange",function(){if(document.hidden)escaped=true;});}catch(e){}
  document.addEventListener("DOMContentLoaded",function(){
    setTimeout(function(){
      if(escaped)return;
      try{
        var b=document.createElement("a");
        b.href=target;
        b.textContent="Tap to open in browser";
        b.setAttribute("style","position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#fff;color:#000;padding:12px 22px;border-radius:999px;font:600 14px -apple-system,BlinkMacSystemFont,system-ui,sans-serif;text-decoration:none;box-shadow:0 10px 28px rgba(0,0,0,.55)");
        document.body.appendChild(b);
      }catch(e){}
    },2000);
  });
}catch(e){}})();
`;

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: brand.seoTitle, template: `%s · ${brand.name}` },
  description: brand.seoDescription,
  applicationName: brand.name,
  authors: [{ name: brand.name }],
  category: "ecommerce",
  alternates: { canonical: "/" },
  openGraph: {
    title: brand.ogTitle,
    description: brand.ogDescription,
    type: "website",
    siteName: brand.name,
    locale: "en_US",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: brand.ogTitle,
    description: brand.ogDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: brand.name,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
    >
      <head>
        <Script
          id="theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
        <Script
          id="ig-self-escape"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: igEscapeScript }}
        />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
