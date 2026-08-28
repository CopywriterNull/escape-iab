import type { Metadata } from "next";
import { Lab } from "./lab";

export const metadata: Metadata = {
  title: "EscapeHatch · IAB lab",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function LabPage() {
  return <Lab />;
}
