import { brand } from "@/lib/branding";
import { siteOrigin } from "@/lib/site";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendResult = { sent: boolean; error: string | null };

function fromAddress(): string {
  return process.env.RESEND_FROM ?? `${brand.name} <invites@${brand.domain}>`;
}

/** Branded team-invite email via the Resend REST API (plain fetch — no SDK
 *  dependency). Best-effort by design: when RESEND_API_KEY is unset or the
 *  request fails we return { sent: false } and the caller surfaces the
 *  copyable accept link instead. Email must never block an invite. */
export async function sendInviteEmail(opts: {
  to: string;
  merchantName: string;
  invitedBy: string | null;
  role: string;
  acceptUrl: string;
}): Promise<SendResult> {
  const inviter = opts.invitedBy ?? "A teammate";
  const subject = `You're invited to ${opts.merchantName} on ${brand.name}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
    <div style="font-size:15px;font-weight:600;margin-bottom:24px">${brand.name}</div>
    <h1 style="font-size:20px;margin:0 0 12px">Join ${escapeHtml(opts.merchantName)}</h1>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 20px">
      ${escapeHtml(inviter)} invited you to the <strong>${escapeHtml(opts.merchantName)}</strong>
      workspace on ${brand.name} as a <strong>${escapeHtml(opts.role)}</strong>.
    </p>
    <a href="${opts.acceptUrl}"
       style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
      Accept invitation
    </a>
    <p style="font-size:12px;color:#888;margin:24px 0 0">
      This link expires in 7 days. If the button doesn't work, paste this URL
      into your browser:<br>
      <span style="word-break:break-all">${opts.acceptUrl}</span>
    </p>
  </div>`;

  return postResendEmail(opts.to, subject, html);
}

/** Shared Resend REST transport. Best-effort by contract: every failure
 *  mode returns { sent: false } — callers decide how to degrade. */
async function postResendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not set" };
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      console.error("[postResendEmail] resend error", res.status, body);
      return { sent: false, error: `resend ${res.status}` };
    }
    return { sent: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    console.error("[postResendEmail] fetch failed", msg);
    return { sent: false, error: msg };
  }
}

/** "You're in" email sent when an admin approves a pending workspace. */
export async function sendApprovalEmail(opts: {
  to: string;
  merchantName: string;
}): Promise<SendResult> {
  const dashboardUrl = `${siteOrigin()}/dashboard`;
  const subject = `You're in — ${opts.merchantName} is live on ${brand.name}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
    <div style="font-size:15px;font-weight:600;margin-bottom:24px">${brand.name}</div>
    <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(opts.merchantName)} is approved</h1>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 20px">
      Your workspace is live. Install the snippet from your dashboard and
      you'll start recovering Instagram checkout revenue within the hour.
    </p>
    <a href="${dashboardUrl}"
       style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
      Open your dashboard
    </a>
  </div>`;
  return postResendEmail(opts.to, subject, html);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
