import type { Metadata } from "next";
import { WebhookTester } from "./webhook-tester";

export const metadata: Metadata = {
  title: "EscapeHatch · Webhook test",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function EarlyAccessTestPage() {
  return <WebhookTester />;
}
