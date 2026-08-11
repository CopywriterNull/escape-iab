import { money } from "@/lib/digest";
import type { GraduationReport } from "@/lib/graduation";

// Block Kit for the ready-to-bill agent.
//
// One card per candidate, and the draft is in the message itself rather than
// behind a link. If you have to open a tab to read it you won't send it today,
// and the whole value of this agent is collapsing "test went significant" and
// "client has the number" into the same morning.
//
// Same component discipline as the digest: header / section / actions /
// context / divider only, so an incoming webhook can't reject the payload.

type Block = Record<string, unknown>;

const MAX_CARDS = 4;

function mrkdwn(text: string) {
  return { type: "mrkdwn", text };
}

function linkButton(label: string, url: string, style?: "primary" | "danger") {
  return {
    type: "button",
    text: { type: "plain_text", text: label, emoji: true },
    url,
    ...(style ? { style } : {}),
  };
}

export function buildGraduationBlocks(r: GraduationReport, origin: string): Block[] {
  const blocks: Block[] = [];
  const n = r.candidates.length;

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text:
        n === 0
          ? ":hourglass:  Nothing ready to bill yet"
          : `:money_with_wings:  ${n} test${n === 1 ? "" : "s"} ready to bill`,
      emoji: true,
    },
  });

  if (n > 0) {
    const totalMonthly = r.candidates.reduce((s, c) => s + c.projectedMonthlyCents, 0);
    blocks.push({
      type: "context",
      elements: [
        mrkdwn(
          `Significant on the randomized test *and* clear of the outlier trim, so the quoted number is the number the first invoice will hit. Together they're worth *${money(totalMonthly)}/mo*. Drafts below are unsent.`,
        ),
      ],
    });
  }

  for (const c of r.candidates.slice(0, MAX_CARDS)) {
    blocks.push({ type: "divider" });

    const lift = `${c.liftPct >= 0 ? "+" : ""}${c.liftPct.toFixed(0)}%`;
    const age =
      c.firstReadyAt == null
        ? ":sparkles: *newly ready*"
        : `flagged before · ${c.posts} post${c.posts === 1 ? "" : "s"}`;
    blocks.push({
      type: "section",
      text: mrkdwn(
        `*${c.name}*  ·  ${age}\n${lift} checkout lift · z ${c.z.toFixed(1)} · ${(c.ordersA + c.ordersB).toLocaleString("en-US")} orders over 14 days`,
      ),
      ...(c.shareToken
        ? { accessory: linkButton("Their dashboard", `${origin}/share/${c.shareToken}`, "primary") }
        : {}),
    });

    blocks.push({
      type: "section",
      fields: [
        mrkdwn(`*Trimmed incremental (30d)*\n${money(c.incremental30dCents)}`),
        mrkdwn(`*Rev share at ${c.revSharePct}%*\n${money(c.shareCents)}/mo`),
        mrkdwn(
          `*Platform fee*\n${c.baseFeeCents === 0 ? "waived" : `${money(c.baseFeeCents)}/mo`}`,
        ),
        mrkdwn(`*First invoice would be*\n${money(c.projectedMonthlyCents)}`),
      ],
    });

    // The trimmed RPV lift usually sits below the CVR lift. Showing both stops
    // the higher one getting quoted to a client by accident.
    if (c.trimmedLiftPct != null && Math.abs(c.trimmedLiftPct - c.liftPct) >= 5) {
      blocks.push({
        type: "context",
        elements: [
          mrkdwn(
            `_Revenue-per-visitor lift after trimming is ${c.trimmedLiftPct >= 0 ? "+" : ""}${c.trimmedLiftPct.toFixed(0)}%, below the ${lift} checkout lift. Quote the checkout number for the result, the dollar number for the fee._`,
          ),
        ],
      });
    }

    blocks.push({
      type: "section",
      text: mrkdwn(`*Draft, unsent*\n\`\`\`${c.draft}\`\`\``),
    });

    blocks.push({
      type: "actions",
      elements: [
        linkButton("Put them on a plan", `${origin}/admin/merchants?focus=${c.merchantId}`, "primary"),
        linkButton("Billing", `${origin}/admin/billing`),
        ...(c.shareToken ? [linkButton("Share link", `${origin}/share/${c.shareToken}`)] : []),
      ],
    });
  }

  if (n > MAX_CARDS) {
    blocks.push({
      type: "context",
      elements: [mrkdwn(`_+${n - MAX_CARDS} more ready, trimmed from this message._`)],
    });
  }

  // Held-back brands are the honest counterweight: without them a quiet
  // message reads as "no tests are working" when the truth is "one is working
  // but the money isn't there yet".
  if (r.heldBack.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: mrkdwn("*Significant, but not billable yet*"),
    });
    for (const h of r.heldBack.slice(0, 5)) {
      blocks.push({
        type: "context",
        elements: [
          mrkdwn(
            `:no_entry_sign:  *${h.name}* — ${h.liftPct >= 0 ? "+" : ""}${h.liftPct.toFixed(0)}% lift. ${h.reason}`,
          ),
        ],
      });
    }
  }

  if (r.suppressed > 0) {
    blocks.push({
      type: "context",
      elements: [
        mrkdwn(
          `_${r.suppressed} ready brand${r.suppressed === 1 ? "" : "s"} not repeated here (posted in the last week, or dismissed)._`,
        ),
      ],
    });
  }

  if (n === 0 && r.heldBack.length === 0) {
    blocks.push({
      type: "context",
      elements: [
        mrkdwn("_No test has both crossed significance and cleared the trim. Nothing to do._"),
      ],
    });
  }

  return blocks;
}

export function graduationSummaryText(r: GraduationReport): string {
  if (r.candidates.length === 0) return "Ready to bill — nothing new.";
  const total = r.candidates.reduce((s, c) => s + c.projectedMonthlyCents, 0);
  return `${r.candidates.length} test${r.candidates.length === 1 ? "" : "s"} ready to bill, ${money(total)}/mo.`;
}
