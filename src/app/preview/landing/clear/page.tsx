import type { Metadata } from "next";
import { LanderClear } from "@/components/LanderClear";

export const metadata: Metadata = {
  title: "Escape Hatch — homepage rewrite preview",
  robots: { index: false, follow: false },
};

export default function ClearLandingPreview() {
  return <LanderClear />;
}
