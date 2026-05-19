import { Lander, type CaseStudyData } from "@/components/Lander";
import { getEscapesLast24Hours, getTestFunnel, zTestTwoProp } from "@/lib/db";

// Revalidate the homepage every 5 min — live counter refreshes too.
export const revalidate = 300;

// G FUEL merchant ID — first customer, source of the proof + counter numbers.
const G_FUEL_MERCHANT_ID = "8b6e80c0-88fd-4c9e-acab-39e21e6d7154";
const CASE_STUDY_WINDOW_DAYS = 14;

export default async function Home() {
  let liftPct: number | null = null;
  let totalRevenueCents = 0;
  let escapesToday = 0;
  let caseStudy: CaseStudyData | null = null;

  try {
    const [funnel14, funnel90, today] = await Promise.all([
      getTestFunnel(G_FUEL_MERCHANT_ID, CASE_STUDY_WINDOW_DAYS),
      getTestFunnel(G_FUEL_MERCHANT_ID, 90),
      getEscapesLast24Hours(),
    ]);

    // 90d numbers still feed the hero proof tiles (longer window = smoother).
    const cvrA90 = funnel90.impressions.a > 0 ? funnel90.purchases.a / funnel90.impressions.a : 0;
    const cvrB90 = funnel90.impressions.b > 0 ? funnel90.purchases.b / funnel90.impressions.b : 0;
    if (cvrA90 > 0 && cvrB90 > 0) liftPct = (cvrA90 - cvrB90) / cvrB90;
    totalRevenueCents = funnel90.revenue_cents.a + funnel90.revenue_cents.b;
    escapesToday = today;

    // 14d numbers feed the anonymized case-study section. % lifts only, no
    // raw counts on the page — keeps low absolute volumes from undermining
    // an otherwise legit story.
    const impA = funnel14.impressions.a;
    const impB = funnel14.impressions.b;
    const purA = funnel14.purchases.a;
    const purB = funnel14.purchases.b;
    const revA = funnel14.revenue_cents.a;
    const revB = funnel14.revenue_cents.b;

    if (impA > 0 && impB > 0 && purA > 0 && purB > 0) {
      const cvrA = purA / impA;
      const cvrB = purB / impB;
      const rpvA = revA / impA;
      const rpvB = revB / impB;
      const aovA = purA > 0 ? revA / purA : 0;
      const aovB = purB > 0 ? revB / purB : 0;

      const z = zTestTwoProp(purA, impA, purB, impB);
      const confidencePct = z ? Math.min(0.99, Math.max(0, 1 - z.pValue)) : 0;

      caseStudy = {
        cvrLiftPct: cvrB > 0 ? (cvrA - cvrB) / cvrB : 0,
        rpvLiftPct: rpvB > 0 ? (rpvA - rpvB) / rpvB : 0,
        aovLiftPct: aovB > 0 ? (aovA - aovB) / aovB : null,
        confidencePct,
        windowDays: CASE_STUDY_WINDOW_DAYS,
      };
    }
  } catch {
    // Network or auth failure — keep defaults.
  }

  return (
    <Lander
      theme="light"
      proof={{ liftPct, totalRevenueCents, escapesToday, caseStudy }}
    />
  );
}
