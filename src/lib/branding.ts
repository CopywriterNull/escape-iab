export const brand = {
  name: "EscapeHatch",
  domain: "escapehatch.app",
  // Hero — names the problem and solution in two beats.
  tagline: "Your Instagram ads work. Your Instagram checkout doesn't.",
  subhead:
    "Every paid IG ad click opens inside Instagram's broken in-app browser. EscapeHatch detects it and reopens your store in Safari before checkout loads. One snippet. 60-second install.",
  ctaPrimary: "Start free",
  // ---- Meta copy — distinct per surface, per 2026 best practice ----
  // SERP <title>: ≤60 chars, keyword-led
  seoTitle: "EscapeHatch · Recover IG ad revenue lost to checkout",
  // SERP <meta description>: 150-160 chars, includes CTA verb
  seoDescription:
    "EscapeHatch detects Instagram's broken in-app browser and reopens your Shopify store in Safari — so paid IG clicks reach checkout. 60-second install.",
  // Social card title (OG/Twitter): 55-60 chars, hook-led
  ogTitle: "Your Instagram ads work. Your checkout doesn't.",
  // Social card description: 150-160 chars, scroll-stopping
  ogDescription:
    "Detects Instagram's broken in-app browser and reopens your store in Safari before checkout loads — so paid IG clicks buy instead of bouncing.",
  // One-liner for elevator pitches / social shares.
  pitchOneLiner:
    "Reclaim 20–40% of your Meta-sourced revenue. EscapeHatch reroutes paid IG visitors out of Instagram's broken in-app browser, into the real one — automatically.",
  // Below-hero positioning beats.
  positioning: {
    cost: {
      eyebrow: "The IG tax",
      headline: "You're paying Meta to send traffic to a dead end.",
      body:
        "Every paid IG click costs $1–3 to acquire. A third of those clicks land in Instagram's in-app browser — where Apple Pay is missing, Shop Pay autofill breaks, and saved sessions don't exist. Customers bounce. You eat the CPC.",
    },
    cause: {
      eyebrow: "Why it breaks",
      headline: "Instagram opens links in a stripped-down WebView.",
      body:
        "Tap any link from inside the IG app — story, ad, profile, DM — and you don't get Safari. You get a sandboxed browser missing the payment sheet, partitioned cookies, and password autofill. Your checkout was never built for it.",
    },
    fix: {
      eyebrow: "How we fix it",
      headline: "One snippet. Detects the IAB. Reroutes to Safari.",
      body:
        "Add a single <script> tag to your theme. We detect every paid IG visitor in the in-app browser and fire a deep link Instagram itself recognizes. The page reopens in Safari before checkout loads. They never see the broken IAB.",
    },
    proof: {
      eyebrow: "What you recover",
      headline: "20–40% more checkouts complete on IG-sourced traffic.",
      body:
        "Built-in A/B test bucketing proves the lift on your own traffic — not vendor case studies. Apple Pay works again. Shop Pay autofill works again. Returning customers are recognized. Your CVR on paid Meta lands where direct traffic does.",
    },
  },
} as const;
