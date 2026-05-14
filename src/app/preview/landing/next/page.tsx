import { Lander, type CaseStudyData } from "@/components/Lander";
import { getEscapesToday, getTestFunnel, zTestTwoProp } from "@/lib/db";

// Preview-only lander with the v2 tightenings:
//   - Hero gets a "Watch how it works ↓" anchor to the demo
//   - Problem + Comparison merged into one section
//   - Features rewritten as "vs a 5-min dev hack"
//   - FAQ items reordered: compliance / pixel / perf / time-to-results first
// Toggled via Lander variant="v2". When approved, set the prop on /app/page.tsx.

export const revalidate = 300;

const G_FUEL_MERCHANT_ID = "8b6e80c0-88fd-4c9e-acab-39e21e6d7154";
const CASE_STUDY_WINDOW_DAYS = 14;

export const metadata = {
  title: "Lander preview · v2",
  robots: { index: false, follow: false },
};

export default async function LanderPreviewV2() {
  let liftPct: number | null = null;
  let totalRevenueCents = 0;
  let escapesToday = 0;
  let caseStudy: CaseStudyData | null = null;

  try {
    const [funnel14, funnel90, today] = await Promise.all([
      getTestFunnel(G_FUEL_MERCHANT_ID, CASE_STUDY_WINDOW_DAYS),
      getTestFunnel(G_FUEL_MERCHANT_ID, 90),
      getEscapesToday(G_FUEL_MERCHANT_ID),
    ]);

    const cvrA90 = funnel90.impressions.a > 0 ? funnel90.purchases.a / funnel90.impressions.a : 0;
    const cvrB90 = funnel90.impressions.b > 0 ? funnel90.purchases.b / funnel90.impressions.b : 0;
    if (cvrA90 > 0 && cvrB90 > 0) liftPct = (cvrA90 - cvrB90) / cvrB90;
    totalRevenueCents = funnel90.revenue_cents.a + funnel90.revenue_cents.b;
    escapesToday = today;

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
      const aovA = revA / purA;
      const aovB = revB / purB;
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
    // Defaults are fine.
  }

  return (
    <>
      {/* Preview ribbon — non-indexed, makes it obvious this is a draft */}
      <div className="bg-[var(--color-accent)] text-white text-center text-[11.5px] font-mono py-1.5 tracking-wide">
        PREVIEW · Lander v2 · not indexed · waiting on approval
      </div>
      <Lander
        theme="light"
        variant="v2"
        proof={{ liftPct, totalRevenueCents, escapesToday, caseStudy }}
      />
    </>
  );
}
