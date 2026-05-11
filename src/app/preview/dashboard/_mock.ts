// Shared mock data so every variant compares against the same numbers.

export const mockData = {
  merchant: { name: "G FUEL", domain: "gfuel.com" },
  range: "14d",
  rangeLabel: "Last 14 days",
  impressions: 12_450,
  escapeAttempts: 7_968,
  escapeRate: 0.64,
  revenue: 8_420,
  purchases: 89,
  liftPct: 0.124,
  pValue: 0.018,
  confident: 0.982,
  funnel: [
    { label: "Impressions", a: 6_225, b: 6_225, sub: "test landings" },
    { label: "Product viewed", a: 2_178, b: 1_980, sub: "/products/*" },
    { label: "Add to cart", a: 1_245, b: 1_058, sub: "added a SKU" },
    { label: "Checkout started", a: 854, b: 712, sub: "reached /checkouts" },
    { label: "Purchase", a: 48, b: 41, sub: "completed" },
  ],
  sources: [
    { utm_source: "instagram", total: 4_820, purchases: 31, revenue: 3120 },
    { utm_source: "ig", total: 3_410, purchases: 24, revenue: 2210 },
    { utm_source: "facebook", total: 2_180, purchases: 19, revenue: 1740 },
    { utm_source: "(direct)", total: 1_240, purchases: 9, revenue: 880 },
    { utm_source: "meta", total: 800, purchases: 6, revenue: 470 },
  ],
  activity: [
    { type: "PURCHASE", bucket: "A", value: "$58.32", utm: "instagram", ago: "3m" },
    { type: "ESCAPE", bucket: "A", value: "", utm: "instagram", ago: "4m" },
    { type: "CHECKOUT", bucket: "B", value: "$42.10", utm: "ig", ago: "8m" },
    { type: "ESCAPE", bucket: "A", value: "", utm: "facebook", ago: "11m" },
    { type: "ATC", bucket: "A", value: "", utm: "instagram", ago: "14m" },
    { type: "PURCHASE", bucket: "B", value: "$77.50", utm: "ig", ago: "22m" },
  ],
} as const;
