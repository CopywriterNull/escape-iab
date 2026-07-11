import type { Metadata } from "next";
import { TeamModel } from "./team-model";

// Internal goal-modeling tool (no login by request). noindex — exposes economics.
export const metadata: Metadata = {
  title: "EscapeHatch · Goal Model",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function TeamModelPage() {
  return <TeamModel />;
}
