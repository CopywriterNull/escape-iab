import { type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/admin";
import { sendBillingReviewEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/site";
import { computeInvoice } from "@/lib/billing/math";
import { buildSnapshot, computePeriodMetrics, nextMonthlyPeriod } from "@/lib/billing/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });

  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: "missing_cron_secret" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return new Response("not configured", { status: 500 });

  const { data: merchants, error } = await sb
    .from("merchants")
    .select("id, name, billing_anchor, rev_share_pct, base_fee_cents, base_fee_waived")
    .eq("billing_status", "active")
    .not("billing_anchor", "is", null);
  if (error) return new Response(error.message, { status: 500 });

  const results: Record<string, string> = {};
  for (const m of merchants ?? []) {
    try {
      const { data: last } = await sb
        .from("billing_invoices")
        .select("period_end")
        .eq("merchant_id", m.id)
        .eq("kind", "monthly")
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();
      const anchor = new Date(m.billing_anchor as string);
      const period = nextMonthlyPeriod(anchor, last ? new Date(last.period_end) : null);
      if (period.end > new Date()) {
        results[m.id] = "not due";
        continue;
      }
      const metrics = await computePeriodMetrics(sb, m.id, anchor, period.start, period.end);
      const comp = computeInvoice({
        impA: metrics.impA,
        trimmedRevACents: metrics.trimmedRevACents,
        impB: metrics.impB,
        trimmedRevBCents: metrics.trimmedRevBCents,
        revSharePct: Number(m.rev_share_pct),
        baseFeeCents: m.base_fee_cents,
        baseFeeWaived: m.base_fee_waived,
      });
      const { error: insErr } = await sb.from("billing_invoices").insert({
        merchant_id: m.id,
        kind: "monthly",
        period_start: period.start.toISOString(),
        period_end: period.end.toISOString(),
        snapshot: buildSnapshot(metrics, comp, {
          rev_share_pct: Number(m.rev_share_pct),
          base_fee_cents: m.base_fee_cents,
          base_fee_waived: m.base_fee_waived,
        }),
        base_fee_cents: comp.baseFeeCents,
        rev_share_cents: comp.revShareCents,
        total_cents: comp.totalCents,
        status: comp.totalCents > 0 ? "pending_review" : "voided",
      });
      if (insErr) {
        // 23505 unique violation = already drafted this period; fine.
        results[m.id] = insErr.code === "23505" ? "already drafted" : `error: ${insErr.message}`;
        continue;
      }
      let emailNote = "";
      if (comp.totalCents > 0) {
        const sent = await sendBillingReviewEmail({
          merchantName: m.name ?? m.id,
          totalCents: comp.totalCents,
          incrementalCents: comp.incrementalCents,
          reviewUrl: `${siteOrigin()}/admin/billing`,
          to: ADMIN_EMAILS,
        });
        if (!sent.sent) {
          console.error(`[cron/billing] review email failed for ${m.id}: ${sent.error ?? "unknown"}`);
          emailNote = ` (email FAILED: ${sent.error ?? "unknown"} — check /admin/billing manually)`;
        }
      }
      results[m.id] = comp.totalCents > 0 ? `drafted${emailNote}` : "auto-voided ($0)";
    } catch (e) {
      results[m.id] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return Response.json({ ok: true, results });
}
