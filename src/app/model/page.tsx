import type { Metadata } from "next";
import { PricingModel } from "./pricing-model";

// Internal deal-modeling tool. Public (no login) by request, but kept out of
// search indexes since it exposes pricing assumptions.
export const metadata: Metadata = {
  title: "EscapeHatch · Deal Model",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function ModelPage() {
  return <PricingModel />;
}
