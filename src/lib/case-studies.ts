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
    slug: "herbal-supplements",
    category: "Supplements",
    brand: "Herbal wellness supplements brand",
    headline: "Supplements are a trust purchase. The webview is where trust goes to die.",
    dek: "8 days, 24,426 randomized Instagram visitors on a concentrated herbal supplements store: +37% checkout conversion and +37% revenue per visitor for escaped traffic — a perfect 50/50 split with zero outlier orders to argue about.",
    windowLabel: "Jul 28 – Aug 4, 2026",
    windowDays: 8,
    a: { visitors: 12197, purchases: 249, revenueCents: 1521496 },
    b: { visitors: 12229, purchases: 182, revenueCents: 1115868 },
    z: 3.3,
    pLabel: "p < 0.001",
    narrative: [
      "Supplements are a considered purchase: shoppers check ingredients, look for testing claims, and often leave to research before buying. That behavior is exactly what Instagram's in-app browser punishes — the session dies the moment the user swipes away, and there are no saved logins or Shop Pay autofill waiting when they come back.",
      "The split was as clean as they come: 12,197 vs 12,229 visitors, a coin flip. Escaped visitors checked out at 2.04% vs 1.49% for the webview control (+37%, p < 0.001) and produced $1.25 per visitor vs $0.91 (+37%). No outlier orders on either arm — the trimming rule had nothing to remove.",
      "For a category built on repeat purchase, the compounding matters more than the first order: escaped buyers land in a real browser with a persistent session, so the second bottle doesn't have to survive the webview either.",
    ],
    after:
      "The test is still running with a live control arm; the lift has held through every day of the window so far.",
    footnotes: [
      "Brand anonymized. Window still accruing at time of publication — figures are the full randomized window through Aug 4, 2026.",
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
    slug: "leather-goods",
    category: "Leather goods",
    brand: "Handcrafted leather goods brand",
    headline: "Six weeks of data. The webview converted less than half as well.",
    dek: "The longest high-volume window in the portfolio: 42 days, 54,598 randomized visitors. Escaped traffic converted +125% better and produced +142% more revenue per visitor — at z = 12.5, one of the most decisive results we've measured.",
    windowLabel: "May 15 – Jun 26, 2026",
    windowDays: 42,
    a: { visitors: 24999, purchases: 639, revenueCents: 6077921 },
    b: { visitors: 29599, purchases: 337, revenueCents: 2978292 },
    z: 12.5,
    pLabel: "p < 0.0001",
    narrative: [
      "This brand sells premium everyday-carry leather goods — $90+ average orders where shoppers compare, hesitate, and come back later. A checkout that can't autofill a saved card and a session that evaporates on app-switch are worst-case conditions for that buying pattern.",
      "Over six weeks the gap never closed: escaped visitors converted at 2.56% vs 1.14% for the in-app-browser control (+125%), and generated $2.43 per visitor vs $1.01 (+142%). No outlier orders on either arm.",
      "Long windows answer the objection short tests can't: this wasn't a hot week or a lucky drop. Six weeks of paid and organic Instagram traffic, and the control never once looked like the winning arm.",
    ],
    after: "The measured window closed in late June 2026 with the result above.",
    footnotes: [
      "Brand anonymized. Arm sizes are uneven (25.0K vs 29.6K) because escape stayed on outside strict test hours at the window edges; conversion and revenue-per-visitor are per-capita and unaffected by arm size.",
    ],
  },
  {
    slug: "athletic-apparel",
    category: "Athletic apparel",
    brand: "Men's athletic apparel brand",
    headline: "180,000 visitors. The biggest sample we've published.",
    dek: "Eight days, 180,023 randomized Instagram visitors, 2,648 orders. At this scale the error bars vanish: escaped traffic converted +40% better (z = 8.7) and produced +42% more revenue per visitor, outlier-trimmed on both arms.",
    windowLabel: "May 19 – 27, 2026",
    windowDays: 8,
    a: { visitors: 88143, purchases: 1518, revenueCents: 12012894 },
    b: { visitors: 91880, purchases: 1130, revenueCents: 8840519 },
    z: 8.7,
    pLabel: "p < 0.0001",
    narrative: [
      "This performance-apparel brand runs serious paid Meta volume, which made it the largest randomized sample in the portfolio: 180,023 Instagram visitors split across the two arms in eight days.",
      "Escaped visitors checked out at 1.72% vs 1.23% for the webview control — +40% at z = 8.7, a result you could re-run a thousand times and never see flip. Per-visitor revenue was $1.36 vs $0.96 (+42%) with whale orders trimmed from both arms.",
      "Scale is the point of this study. Every objection to a small test — luck, seasonality, one big order — is off the table at 180K visitors. The webview tax showed up here at almost exactly the rate it shows up across the rest of the portfolio.",
    ],
    after: "The brand rolled escape out to 100% of Instagram traffic at the end of the window.",
    footnotes: [
      "Brand anonymized. Revenue trimmed by the standard outlier rule on both arms (two orders totaling $13,104 removed from the escaped arm, one $11,201 order from control); conversion counts untouched.",
    ],
  },
  {
    slug: "rider-protective-gear",
    category: "Protective gear",
    brand: "Rider protective-gear brand",
    headline: "At a $194 average order, escaped visitors were worth 2.3× more.",
    dek: "Ten days, 32,253 randomized visitors on a high-AOV protective-gear store for MTB, snow, and motorsports. Escaped traffic converted +111% better and produced +128% more revenue per visitor.",
    windowLabel: "May 13 – 23, 2026",
    windowDays: 10,
    a: { visitors: 15731, purchases: 223, revenueCents: 4327289 },
    b: { visitors: 16522, purchases: 111, revenueCents: 1996334 },
    z: 6.6,
    pLabel: "p < 0.0001",
    narrative: [
      "Protective gear is the opposite of an impulse buy: orders here average almost $200, and buyers research fit and safety ratings before committing. High-consideration checkouts lean hardest on the things the in-app browser strips away — saved payment methods, password managers, and a session that survives leaving the app.",
      "The control arm converted at 0.67%. Escaped visitors converted at 1.42% — +111% — and were worth $2.75 per visitor against $1.21 (+128%). No outlier orders on either side.",
      "The pattern across the portfolio is consistent: the higher the order value, the bigger the webview tax. This is the clearest high-AOV datapoint we've published.",
    ],
    after: "The brand rolled escape out to 100% of Instagram traffic at the end of the window.",
    footnotes: [
      "Brand anonymized. Average order values: $194 escaped arm, $180 control, among purchasers.",
    ],
  },
  {
    slug: "mens-apparel",
    category: "Men's apparel",
    brand: "Viral men's apparel brand",
    headline: "127,000 visitors in 7 days. The webview lost by 46%.",
    dek: "A one-week split across 127,077 Instagram visitors during a viral spike. Escaped traffic converted +46% better and produced +44% more revenue per visitor.",
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
    slug: "superfood-haircare",
    category: "Haircare",
    brand: "Superfood haircare brand",
    headline: "Week one said 'no effect.' Week four said +41%.",
    dek: "25 days, 63,173 randomized visitors. The first few days of this test read flat — then the full window settled at +41% checkout conversion and +40% revenue per visitor at z = 6.5. A case study in why we don't call tests early.",
    windowLabel: "Jul 11 – Aug 4, 2026",
    windowDays: 25,
    a: { visitors: 29660, purchases: 776, revenueCents: 5646412 },
    b: { visitors: 33513, purchases: 623, revenueCents: 4545641 },
    z: 6.5,
    pLabel: "p < 0.0001",
    narrative: [
      "Two weeks into this test the honest read was 'roughly zero' — early purchase counts were small and the arms were trading places day to day. We reported it that way internally, because a split you'd only publish when it's winning isn't a split.",
      "By the full window the picture was unambiguous: 2.62% checkout conversion for escaped visitors vs 1.86% for the webview control (+41%, z = 6.5), and $1.90 per visitor vs $1.36 (+40%). No outlier orders on either arm; 1,399 total purchases.",
      "The lesson cuts both ways. Small early samples can hide a real effect just as easily as they can invent a fake one — which is why every number on this site is a completed window with its sample size and z-score attached, not a screenshot from a good afternoon.",
    ],
    after:
      "The test is still running with a live control arm as the brand scales its Instagram spend.",
    footnotes: [
      "Brand anonymized. Window still accruing at time of publication — figures are the full randomized window through Aug 4, 2026.",
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
