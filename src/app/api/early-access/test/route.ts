import { NextResponse } from "next/server";

// Internal diagnostic: fires a sample lead at the configured webhook and returns
// exactly what came back, so we can tell "env not set" from "Make scenario is
// off" (410) from "working". Sends test:true so it's filterable in Make.
export async function GET() {
  const webhookUrl = process.env.EARLY_ACCESS_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({
      ok: false,
      configured: false,
      hint: "EARLY_ACCESS_WEBHOOK_URL is not set in this environment.",
    });
  }

  const sample = {
    source: "webhook_test",
    test: true,
    submittedAt: new Date().toISOString(),
    email: "webhook-test@escapehatch.internal",
    company: "Webhook Test",
    website: "https://example.com",
    monthlyVisitors: "50k-250k",
    platform: "Shopify",
    referralSource: "Twitter / X",
    notes: "Automated connectivity test — safe to ignore/delete.",
    page: "/early-access-test",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sample),
      signal: controller.signal,
    });
    const body = (await res.text().catch(() => "")).slice(0, 500);
    return NextResponse.json({
      ok: res.ok,
      configured: true,
      status: res.status,
      statusText: res.statusText,
      body,
      hint: interpret(res.status, body),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      configured: true,
      error: "webhook_failed",
      hint: "Request to the webhook failed (timeout or network). Check the URL.",
      detail: String(e).slice(0, 200),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function interpret(status: number, body: string): string {
  if (status >= 200 && status < 300) return "Working — the webhook accepted the test lead. Check your Make scenario history.";
  if (status === 410 || /no scenario listening/i.test(body))
    return "The Make scenario is OFF. Turn the scenario ON in Make (bottom-left toggle), then test again.";
  if (status === 400) return "The webhook rejected the payload (400). Check the scenario's expected data structure.";
  if (status === 404) return "Webhook URL not found (404). Double-check the hook URL.";
  return `Unexpected status ${status}. See the raw response below.`;
}
