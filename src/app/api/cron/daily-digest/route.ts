import { type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";
import { buildDigest } from "@/lib/digest";
import { buildDigestBlocks, digestSummaryText } from "@/lib/digest-blocks";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Daily ops digest → Slack (docs/OPERATIONS.md §Automation).
//
// Data lives in src/lib/digest.ts, presentation in src/lib/digest-blocks.ts.
// This route is just auth + transport, so the digest can be rendered anywhere
// (a test post, an email, an admin preview) without duplicating the math.
//
// Without SLACK_WEBHOOK_URL — or with ?dry=1 — it returns the composed payload
// as JSON instead of posting, which is the safe way to preview a change.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return new Response("not configured", { status: 500 });

  const origin = siteOrigin();
  const digest = await buildDigest(sb, Date.now());
  const blocks = buildDigestBlocks(digest, origin);
  const text = digestSummaryText(digest);

  const webhook = process.env.SLACK_WEBHOOK_URL;
  const dry = req.nextUrl.searchParams.get("dry") === "1" || !webhook;
  if (dry) {
    return Response.json({
      posted: false,
      reason: webhook ? "dry=1" : "no SLACK_WEBHOOK_URL",
      payload: { text, blocks },
      digest,
    });
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, blocks }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Response.json(
      { posted: false, slackStatus: res.status, slackBody: body, payload: { text, blocks } },
      { status: 502 },
    );
  }
  return Response.json({ posted: true, attention: digest.attention.length });
}
