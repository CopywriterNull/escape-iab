import { type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";
import { buildGraduationReport, recordPosted } from "@/lib/graduation";
import { buildGraduationBlocks, graduationSummaryText } from "@/lib/graduation-blocks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Ready-to-bill agent → Slack (docs/OPERATIONS.md §Automation).
//
// Auth and transport only. The gate lives in src/lib/graduation.ts and the
// presentation in src/lib/graduation-blocks.ts, so this can be previewed
// anywhere without re-running the money math a second way.
//
// ?dry=1 returns the payload without posting AND without recording, so a
// preview never suppresses tomorrow's real post.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return new Response("not configured", { status: 500 });

  const now = Date.now();
  const origin = siteOrigin();
  const report = await buildGraduationReport(sb, now, origin);
  const blocks = buildGraduationBlocks(report, origin);
  const text = graduationSummaryText(report);

  const webhook = process.env.SLACK_WEBHOOK_URL;
  const dry = req.nextUrl.searchParams.get("dry") === "1" || !webhook;
  if (dry) {
    return Response.json({
      posted: false,
      reason: webhook ? "dry=1" : "no SLACK_WEBHOOK_URL",
      payload: { text, blocks },
      report,
    });
  }

  // A quiet day shouldn't cost a Slack message. The digest already reports the
  // pipeline; this channel is for "there is money to collect".
  if (report.candidates.length === 0) {
    return Response.json({ posted: false, reason: "no candidates", heldBack: report.heldBack.length });
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, blocks }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Response.json(
      { posted: false, slackStatus: res.status, slackBody: body },
      { status: 502 },
    );
  }

  // Only after a confirmed post — a failed webhook must not silence tomorrow.
  await recordPosted(sb, report.candidates, now);

  return Response.json({ posted: true, candidates: report.candidates.length });
}
