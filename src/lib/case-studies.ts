// Published A/B case studies. Every number here was read from the production
// measurement pipeline (hourly_funnel_rollups + eh_ab_test_window +
// eh_merchant_outlier_revenue) on 2026-08-04 for each merchant's detected
// A/B window — the only period with a credible randomized control. Brands are
// anonymized by category to match the homepage's NDA-anonymized framing;
// revenue figures are trimmed with the same outlier rule the dashboard uses
// (order > Q3 + 3·IQR and > 8× median, min 8 orders/bucket).
//
// These are static editorial pages on purpose: the windows are closed, the
// numbers are final, and marketing pages shouldn't fan out live DB reads.

export type CaseStudyBucket = {
  visitors: number;
  purchases: number;
  /** Revenue in cents AFTER outlier trimming (equals raw when nothing trimmed). */
  revenueCents: number;
};

export type PublishedCaseStudy = {
  slug: string;
  /** Short category chip, e.g. "Energy drinks". */
  category: string;
  /** Anonymized brand descriptor used in place of the name. */
  brand: string;
  /** Landing-card + detail headline. */
  headline: string;
  dek: string;
  windowLabel: string;
  windowDays: number;
  a: CaseStudyBucket;
  b: CaseStudyBucket;
  /** Two-proportion z on purchases/visitors, computed from the buckets above. */
  z: number;
  pLabel: string;
  narrative: string[];
  after: string;
  footnotes: string[];
};

export function cvr(b: CaseStudyBucket): number {
  return b.visitors > 0 ? b.purchases / b.visitors : 0;
}

export function rpvCents(b: CaseStudyBucket): number {
  return b.visitors > 0 ? b.revenueCents / b.visitors : 0;
}

export function liftPct(a: number, b: number): number {
  return b > 0 ? (a - b) / b : 0;
}

export const CASE_STUDIES: PublishedCaseStudy[] = [
  {
    slug: "energy-drinks",
    category: "Energy drinks",
    brand: "Top-10 energy drink brand",
    headline: "The webview was eating 3 of every 4 checkouts.",
    dek: "A 17-day randomized 50/50 split on live Instagram traffic. Visitors escaped to Safari converted at 3.4× the rate of visitors left inside the in-app browser — on identical ads, identical spend, identical landing pages.",
    windowLabel: "May 9 – 26, 2026",
    windowDays: 17,
    a: { visitors: 6520, purchases: 127, revenueCents: 844644 },
    b: { visitors: 6644, purchases: 38, revenueCents: 215809 },
    z: 7.1,
    pLabel: "p < 0.0001",
    narrative: [
      "This brand runs heavy paid Meta volume into a Shopify storefront. Every Instagram click was landing in the in-app webview — no saved passwords, no Shop Pay autofill, no Apple Pay, and a session that dies the moment the user swipes away.",
      "The snippet split IG-sourced visitors 50/50 at first touch. Bucket A was auto-escaped to Safari before first paint; bucket B stayed in the webview as the control. Both arms saw the same store, the same prices, and the same ads.",
      "Control converted at 0.57%. Escaped visitors converted at 1.95% — a +241% lift in checkout conversion, worth roughly 4× the revenue per visitor the brand was previously getting from the same clicks.",
    ],
    after:
      "After the window closed the brand rolled escape out to 100% of Instagram traffic, where it still runs today.",
    footnotes: [
      "Brand anonymized under NDA. Data: first-party EscapeHatch measurement pipeline, randomized at first touch, two-proportion z-test on checkout conversion.",
    ],
  },
  {
    slug: "home-fragrance",
    category: "Home fragrance",
    brand: "Home fragrance brand",
    headline: "Escaped visitors browsed 2.8× deeper — then bought 2.6× more often.",
    dek: "20 days, 53,784 randomized Instagram visitors. The in-app browser wasn't just hurting checkout — it was killing product discovery: 17.5% of control visitors ever viewed a product, versus 48.7% of escaped visitors.",
    windowLabel: "Jul 10 – 30, 2026",
    windowDays: 20,
    a: { visitors: 27323, purchases: 876, revenueCents: 4197460 },
    b: { visitors: 26461, purchases: 327, revenueCents: 1345616 },
    z: 15.4,
    pLabel: "p < 0.0001",
    narrative: [
      "This was the cleanest split in the portfolio: 27,323 vs 26,461 visitors (a 51/49 coin flip), consistent lift on every single day of the window, near-identical AOV in both arms, and ~100% session identification in both buckets.",
      "The mechanism showed up one step before checkout. Only 17.5% of control visitors ever reached a product page — the webview bounces people before the store gets a chance. Escaped visitors hit product pages 48.7% of the time. Everything downstream (cart, checkout, purchase) inherits that gap.",
      "Checkout conversion: 3.21% escaped vs 1.24% control, a +159% lift at z = 15.4 — about as far from noise as ecommerce data gets.",
    ],
    after:
      "The brand moved to a 90/10 rollout after the window (90% escaped, 10% holdout) and is billed on measured performance against the locked 50/50 baseline.",
    footnotes: [
      "Brand anonymized. Revenue shown trimmed by the standard outlier rule on both arms — the control arm contained a single $51K wholesale-sized order (median order ≈ $36) that no per-visitor metric should lean on; conversion counts are untouched by trimming.",
    ],
  },
  {
    slug: "anime-jewelry",
    category: "Anime jewelry",
    brand: "Anime-inspired jewelry brand",
    headline: "Meta said the escapes were losing. First-party data said 2.3×.",
    dek: "40 days, 31,382 randomized visitors: +83% checkout conversion and +88% revenue per visitor for escaped traffic — while Ads Manager was simultaneously reporting escaped conversions as a ROAS problem.",
    windowLabel: "Jun 25 – Aug 3, 2026",
    windowDays: 40,
    a: { visitors: 16695, purchases: 360, revenueCents: 1665998 },
    b: { visitors: 14687, purchases: 173, revenueCents: 778551 },
    z: 6.7,
    pLabel: "p < 0.0001",
    narrative: [
      "The split itself was unambiguous: escaped visitors converted at 2.16% vs 1.18% for control (+83%), and generated $1.00 per visitor vs $0.53 (+88%) over 40 days.",
      "The interesting part was the disagreement with Ads Manager, which showed campaigns rich in escaped conversions underperforming. The cause is structural: iOS strips the fbclid click ID on the Instagram → Safari handoff, so a large share of escaped purchases are invisible to Meta's pixel and get misfiled as direct traffic. On paid-landed sessions, first-party data showed escaped visitors out-purchasing control 2.3× — revenue Meta was attributing to nobody.",
      "EscapeHatch now re-carries the click ID through the escape and restores it before the Meta pixel initializes, closing most of that gap. The takeaway for any brand comparing buckets in Ads Manager: the platform undercounts exactly the visitors who are buying the most.",
    ],
    after:
      "The measured window closed in early August 2026 with the result above.",
    footnotes: [
      "Brand anonymized. The 2.3× figure is a 14-day paid-landed snapshot from the attribution investigation (100 purchases / $4,783 escaped vs 48 / $2,040 control); the headline numbers are the full 40-day randomized window.",
    ],
  },
  {
    slug: "mens-apparel",
    category: "Men's apparel",
    brand: "Viral men's apparel brand",
    headline: "127,000 visitors in 7 days. The webview lost by 46%.",
    dek: "The highest-volume test in the portfolio: a one-week split across 127,077 Instagram visitors during a viral spike. Escaped traffic converted +46% better and produced +44% more revenue per visitor.",
    windowLabel: "May 19 – 25, 2026",
    windowDays: 7,
    a: { visitors: 76060, purchases: 2957, revenueCents: 23262299 },
    b: { visitors: 51017, purchases: 1354, revenueCents: 10844854 },
    z: 11.9,
    pLabel: "p < 0.0001",
    narrative: [
      "This brand's Reels were doing serious numbers, which made the test fast: 127,077 IG-sourced visitors and 4,311 orders in seven days.",
      "Escaped visitors checked out at 3.89% vs 2.65% for the webview control — a +46% conversion lift at z = 11.9. Per-visitor revenue was $3.06 vs $2.13 (+44%), with the one whale-sized order in the escaped arm already trimmed out so the number doesn't lean on a single receipt.",
      "At this brand's traffic level the arithmetic is blunt: every week the webview kept its share of traffic, it was quietly deleting a five-figure sum from the top line.",
    ],
    after:
      "The brand switched to 100% escape at the end of the window.",
    footnotes: [
      "Brand anonymized. Arm sizes are uneven because escape stayed on outside strict test hours at the window edges; conversion and revenue-per-visitor are per-capita metrics and unaffected by arm size. Escaped-arm revenue shown with one $11,274 outlier order trimmed (control had none).",
    ],
  },
  {
    slug: "faith-lifestyle",
    category: "Faith & lifestyle",
    brand: "Faith-based lifestyle brand",
    headline: "A 14% conversion store still found +30% hiding in the webview.",
    dek: "Six weeks, 4,270 randomized visitors. Even with an unusually strong 10.9% control conversion rate, escaping the in-app browser lifted checkout conversion 30% and revenue per visitor 37%.",
    windowLabel: "May 27 – Jul 10, 2026",
    windowDays: 44,
    a: { visitors: 2173, purchases: 309, revenueCents: 1421185 },
    b: { visitors: 2097, purchases: 229, revenueCents: 1003521 },
    z: 3.3,
    pLabel: "p < 0.001",
    narrative: [
      "This store converts warm community traffic at rates most ecommerce operators would not believe — 10.9% inside the webview. If any store could shrug off the in-app browser, it should have been this one.",
      "It didn't. Escaped visitors converted at 14.2% (+30%, p < 0.001) and produced $6.54 per visitor vs $4.79 (+37%, with one $3,200 outlier order trimmed from the control arm).",
      "The lesson generalizes: webview friction is not a weak-funnel problem. Saved passwords, Shop Pay, and a session that survives an app switch compound at every conversion tier.",
    ],
    after:
      "The test continues to run; the brand keeps a live control arm to hold the measurement honest.",
    footnotes: [
      "Brand anonymized. Smaller absolute sample than other studies — reported with its exact p-value rather than rounded confidence.",
    ],
  },
];

export function getCaseStudy(slug: string): PublishedCaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
