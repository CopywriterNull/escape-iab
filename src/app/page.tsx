import { Lander } from "@/components/Lander";
import { getEscapesToday, getTestFunnel } from "@/lib/db";

// Revalidate the homepage every 5 min — live counter refreshes too.
export const revalidate = 300;

// G FUEL merchant ID — first customer, source of the proof + counter numbers.
const G_FUEL_MERCHANT_ID = "8b6e80c0-88fd-4c9e-acab-39e21e6d7154";

export default async function Home() {
  // Compute proof tile values from G FUEL's last-90d funnel.
  // Gracefully fall back to known-good defaults if the fetch fails.
  let liftPct: number | null = null;
  let totalRevenueCents = 0;
  let escapesToday = 0;
  try {
    const [funnel, today] = await Promise.all([
      getTestFunnel(G_FUEL_MERCHANT_ID, 90),
      getEscapesToday(G_FUEL_MERCHANT_ID),
    ]);
    const baseA = funnel.impressions.a;
    const baseB = funnel.impressions.b;
    const cvrA = baseA > 0 ? funnel.purchases.a / baseA : 0;
    const cvrB = baseB > 0 ? funnel.purchases.b / baseB : 0;
    if (cvrB > 0 && cvrA > 0) liftPct = (cvrA - cvrB) / cvrB;
    totalRevenueCents = funnel.revenue_cents.a + funnel.revenue_cents.b;
    escapesToday = today;
  } catch {
    // Network or auth failure — keep defaults.
  }

  return (
    <Lander theme="light" proof={{ liftPct, totalRevenueCents, escapesToday }} />
  );
}
