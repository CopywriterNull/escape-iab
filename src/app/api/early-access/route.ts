import { NextResponse } from "next/server";

type EarlyAccessPayload = {
  email?: string;
  company?: string;
  website?: string;
  monthlyVisitors?: string;
  platform?: string;
  referralSource?: string;
  notes?: string;
  page?: string;
};

const MAX_FIELD_LENGTH = 500;

export async function POST(req: Request) {
  let body: EarlyAccessPayload;
  try {
    body = (await req.json()) as EarlyAccessPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const email = clean(body.email, 160);
  const company = clean(body.company, 120);
  const website = clean(body.website, 240);
  const monthlyVisitors = clean(body.monthlyVisitors, 60);
  const platform = clean(body.platform, 80);
  const referralSource = clean(body.referralSource, 80);
  const notes = clean(body.notes, MAX_FIELD_LENGTH);
  const page = clean(body.page, 240);

  if (!email || !company || !website || !monthlyVisitors || !platform) {
    return NextResponse.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  const webhookUrl = process.env.EARLY_ACCESS_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: "webhook_not_configured" }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "escapehatch_homepage",
        submittedAt: new Date().toISOString(),
        email,
        company,
        website,
        monthlyVisitors,
        platform,
        referralSource,
        notes,
        page,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "webhook_rejected" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "webhook_failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
