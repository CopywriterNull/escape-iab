import { NextResponse } from "next/server";

// Inbound lead handler for /get-started.
//
// Only the store URL and a work email are required now — the old route demanded
// five fields, so a half-filled form returned a 400 and the lead was simply
// lost. Everything else is optional context we can ask for on the call.
//
// Delivery is best-effort to two places and the submitter's success does not
// depend on either: SLACK_LEADS_WEBHOOK_URL (falling back to
// SLACK_WEBHOOK_URL) for the #leads channel, and EARLY_ACCESS_WEBHOOK_URL for
// whatever automation was already wired up. A lead is never rejected because a
// webhook is down — losing a real prospect is worse than a missed notification.

type Payload = {
  email?: string;
  company?: string;
  website?: string;
  adSpend?: string;
  notes?: string;
  page?: string;
  // Legacy fields, still accepted so older embeds keep working.
  monthlyVisitors?: string;
  platform?: string;
  referralSource?: string;
};

const MAX_FIELD_LENGTH = 500;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeWebsite(v: string): string {
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Big spenders get flagged so they're answered first. */
function isHot(adSpend: string): boolean {
  return adSpend.includes("$50k") || adSpend.includes("$250k");
}

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const email = clean(body.email, 160);
  const website = normalizeWebsite(clean(body.website, 240));
  const company = clean(body.company, 120) || hostLabel(website);
  const adSpend = clean(body.adSpend, 60);
  const notes = clean(body.notes, MAX_FIELD_LENGTH);
  const page = clean(body.page, 240);

  if (!email || !email.includes("@") || !website) {
    return NextResponse.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  const lead = {
    source: "escapehatch_get_started",
    submittedAt: new Date().toISOString(),
    email,
    company,
    website,
    adSpend,
    notes,
    page,
    monthlyVisitors: clean(body.monthlyVisitors, 60),
    platform: clean(body.platform, 80),
    referralSource: clean(body.referralSource, 80),
  };

  await Promise.allSettled([postToSlack(lead), postToAutomation(lead)]);

  return NextResponse.json({ ok: true });
}

type Lead = {
  email: string;
  company: string;
  website: string;
  adSpend: string;
  notes: string;
};

async function postToSlack(lead: Lead) {
  const url = process.env.SLACK_LEADS_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  const hot = isHot(lead.adSpend);
  const label = lead.company || lead.website;
  const fields: { type: string; text: string }[] = [
    { type: "mrkdwn", text: `*Store*\n<${lead.website}|${label}>` },
    { type: "mrkdwn", text: `*Email*\n<mailto:${lead.email}|${lead.email}>` },
  ];
  if (lead.adSpend) fields.push({ type: "mrkdwn", text: `*Meta spend*\n${lead.adSpend}` });

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: hot ? `:fire: New lead — ${label}` : `New lead — ${label}`,
        emoji: true,
      },
    },
    { type: "section", fields },
  ];
  if (lead.notes) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*They said*\n_“${lead.notes}”_` },
    });
  }
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Reply", emoji: true },
        url: `mailto:${lead.email}?subject=${encodeURIComponent("Your Escape Hatch two-week test")}`,
        ...(hot ? { style: "primary" } : {}),
      },
      { type: "button", text: { type: "plain_text", text: "Open store", emoji: true }, url: lead.website },
    ],
  });

  await withTimeout(
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `New lead: ${label} (${lead.email})`, blocks }),
    }),
  );
}

async function postToAutomation(lead: Record<string, unknown>) {
  const url = process.env.EARLY_ACCESS_WEBHOOK_URL;
  if (!url) return;
  await withTimeout(
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lead),
    }),
  );
}

async function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T | null> {
  const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([p.catch(() => null), timer]);
}
