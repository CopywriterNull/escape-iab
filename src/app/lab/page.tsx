import type { Metadata } from "next";
import { Lab } from "./lab";

export const metadata: Metadata = {
  title: "EscapeHatch · IAB lab",
  robots: { index: false, follow: false },
};

// Never cache: this page is iterated on constantly and is opened inside an IAB
// that happily serves a stale copy, which makes a test look like a failed route.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function LabPage() {
  return <Lab />;
}
