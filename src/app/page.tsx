import { Lander, type CalculatorProof, type CaseStudyData } from "@/components/Lander";
import { getEscapesLast24Hours, getTestFunnel, zTestTwoProp } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Revalidate the homepage every 5 min — live counter refreshes too.
export const revalidate = 300;

// G FUEL merchant ID — first customer, source of the proof + counter numbers.
const G_FUEL_MERCHANT_ID = "8b6e80c0-88fd-4c9e-acab-39e21e6d7154";
const CASE_STUDY_WINDOW_DAYS = 14;
const CALCULATOR_WINDOW_DAYS = 7;
const CALCULATOR_HAIRCUT = 0.25;
const MIN_RECOVERY_RATE = 0.015;
const MAX_RECOVERY_RATE = 0.06;

type PortfolioRow = {
  merchant_id: string;
  impressions_a: number | string | null;
  impressions_b: number | string | null;
  revenue_cents_a: number | string | null;
  revenue_cents_b: number | string | null;
};

export default async function Home() {
  let liftPct: number | null = null;
  let rpvLiftPct: number | null = null;
  let escapesToday = 0;
  let caseStudy: CaseStudyData | null = null;
  const calculatorPromise = loadPortfolioCalculatorProof().catch(() => null);

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
    const rpvA90 = funnel90.impressions.a > 0 ? funnel90.revenue_cents.a / funnel90.impressions.a : 0;
    const rpvB90 = funnel90.impressions.b > 0 ? funnel90.revenue_cents.b / funnel90.impressions.b : 0;
    if (rpvA90 > 0 && rpvB90 > 0) rpvLiftPct = (rpvA90 - rpvB90) / rpvB90;
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
  const calculator = await calculatorPromise;

  return (
    <Lander
      theme="light"
      proof={{ liftPct, rpvLiftPct, escapesToday, caseStudy, calculator }}
    />
  );
}

async function loadPortfolioCalculatorProof(): Promise<CalculatorProof | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const since = new Date(new Date().getTime() - CALCULATOR_WINDOW_DAYS * 86400_000).toISOString();
  const { data, error } = await admin.rpc("eh_admin_brand_performance", { p_since: since });
  if (error) return null;

  const portfolioRows = ((data ?? []) as PortfolioRow[]).filter((row) => {
    return toInt(row.impressions_a) + toInt(row.impressions_b) > 0;
  });
  const visitorsA = portfolioRows.reduce((sum, row) => sum + toInt(row.impressions_a), 0);
  const visitorsB = portfolioRows.reduce((sum, row) => sum + toInt(row.impressions_b), 0);
  const revenueA = portfolioRows.reduce((sum, row) => sum + toInt(row.revenue_cents_a), 0);
  const revenueB = portfolioRows.reduce((sum, row) => sum + toInt(row.revenue_cents_b), 0);
  const visitors = visitorsA + visitorsB;
  const revenue = (revenueA + revenueB) / 100;
  const rpvA = visitorsA > 0 ? revenueA / visitorsA / 100 : null;
  const rpvB = visitorsB > 0 ? revenueB / visitorsB / 100 : null;
  const rpvDelta = rpvA != null && rpvB != null ? rpvA - rpvB : null;
  const portfolioRpvLift = rpvDelta != null && rpvB != null && rpvB > 0 ? rpvDelta / rpvB : null;
  const projectedDelta = rpvA != null ? visitors * rpvA - revenue : null;
  const observedRecoveryRate = projectedDelta != null && projectedDelta > 0 && revenue > 0
    ? projectedDelta / revenue
    : null;

  if (portfolioRows.length === 0 || observedRecoveryRate == null) return null;

  return {
    recoveryRate: clamp(observedRecoveryRate * CALCULATOR_HAIRCUT, MIN_RECOVERY_RATE, MAX_RECOVERY_RATE),
    rpvLiftPct: portfolioRpvLift,
    rpvDelta,
    visitors,
    activeBrands: portfolioRows.length,
    rangeLabel: `${CALCULATOR_WINDOW_DAYS}d`,
  };
}

function toInt(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
