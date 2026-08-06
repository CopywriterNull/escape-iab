import { compactMoney, money, pctDelta, MIN_CONTROL_ORDERS, type Digest } from "@/lib/digest";
import { formatWaiting } from "@/lib/slack-followups";

// Block Kit composition for the daily digest.
//
// Layout rules, in priority order:
//  1. The first screenful answers "does anything need me?" — status in the
//     header, then one actionable row per item with a button that lands on the
//     exact admin page that fixes it.
//  2. Numbers get a field grid (Slack renders two columns) with day-over-day
//     movement, so a number means something without opening a dashboard.
//  3. The test pipeline is the body of the report: 14-day randomized lift per
//     brand, sorted so "ready to pitch" is always on top.
//  4. Rolled-out flat-fee clients never take a row — they'd dominate on raw
//     revenue and there is no live test to report. They get one context line.
//
// Only long-stable Block Kit components are used (header / section+fields /
// section+accessory / actions / divider / context) so the payload can't fail
// against an incoming webhook.

type Block = Record<string, unknown>;

const MAX_ATTENTION_ROWS = 6;
const MAX_PIPELINE_ROWS = 5;
const MAX_FOLLOWUP_ROWS = 6;

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

function num(n: number): string {
  return n.toLocaleString("en-US");
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[(m ?? 1) - 1]} ${d}, ${y}`;
}

export function buildDigestBlocks(d: Digest, origin: string): Block[] {
  const blocks: Block[] = [];
  const critical = d.attention.filter((a) => a.severity === "critical").length;
  const total = d.attention.length;

  // ---- Header: the whole point of the message in one line ----
  const headline =
    total === 0
      ? `:large_green_circle:  All clear · ${prettyDate(d.dateLabel)}`
      : critical > 0
        ? `:rotating_light:  ${total} need${total === 1 ? "s" : ""} you · ${prettyDate(d.dateLabel)}`
        : `:large_yellow_circle:  ${total} to review · ${prettyDate(d.dateLabel)}`;
  blocks.push({ type: "header", text: { type: "plain_text", text: headline, emoji: true } });
  blocks.push({
    type: "context",
    elements: [
      mrkdwn(
        total === 0
          ? "Queues clear, rollups fresh, every snippet firing. Numbers below cover the last 24 hours."
          : "Each item below links straight to the page that fixes it. Numbers cover the last 24 hours.",
      ),
    ],
  });

  // ---- Attention: one row, one fix ----
  if (total > 0) {
    for (const item of d.attention.slice(0, MAX_ATTENTION_ROWS)) {
      blocks.push({
        type: "section",
        text: mrkdwn(`${item.emoji}  ${item.text}`),
        accessory: linkButton(
          item.actionLabel,
          `${origin}${item.actionPath}`,
          item.severity === "critical" ? "danger" : undefined,
        ),
      });
    }
    if (total > MAX_ATTENTION_ROWS) {
      blocks.push({
        type: "context",
        elements: [mrkdwn(`_+${total - MAX_ATTENTION_ROWS} more waiting in the admin console._`)],
      });
    }
  }

  blocks.push({ type: "divider" });

  // ---- Portfolio numbers, with day-over-day movement ----
  blocks.push({ type: "section", text: mrkdwn("*Portfolio · last 24 hours*") });
  blocks.push({
    type: "section",
    fields: [
      mrkdwn(`*Visitors escaped*\n${num(d.totals.visitors)}${pctDelta(d.totals.visitors, d.priorTotals.visitors)}`),
      mrkdwn(`*Purchases*\n${num(d.totals.purchases)}${pctDelta(d.totals.purchases, d.priorTotals.purchases)}`),
      mrkdwn(
        `*Revenue tracked*\n${money(d.totals.revenueCents)}${pctDelta(d.totals.revenueCents, d.priorTotals.revenueCents)}`,
      ),
      mrkdwn(`*Brands with traffic*\n${num(d.totals.brands)}`),
    ],
  });
  if (d.rolledOut.count > 0) {
    const names = d.rolledOut.names.slice(0, 3).join(", ");
    const extra = d.rolledOut.names.length > 3 ? ` +${d.rolledOut.names.length - 3}` : "";
    blocks.push({
      type: "context",
      elements: [
        mrkdwn(
          `_${compactMoney(d.rolledOut.revenueCents)} of that is rolled-out flat-fee clients (${names}${extra}) — fully escaped, no live test, nothing to report._`,
        ),
      ],
    });
  }

  // ---- Test pipeline: the brands we actually report on ----
  const shown = d.pipeline.filter((b) => b.state !== "quiet").slice(0, MAX_PIPELINE_ROWS);
  const quiet = d.pipeline.filter((b) => b.state === "quiet");
  if (shown.length > 0 || quiet.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: mrkdwn("*Test pipeline* · 14-day randomized results, brands still running a 50/50"),
    });
  }
  for (const b of shown) {
    const lift = b.liftPct != null ? `${b.liftPct >= 0 ? "+" : ""}${b.liftPct.toFixed(0)}%` : "—";
    const z = b.z != null ? `z ${b.z.toFixed(1)}` : "";
    let line: string;
    if (b.state === "ready") {
      line = `:white_check_mark:  *${b.name}* — *${lift}* checkout lift · ${z} · ${num(b.ordersA + b.ordersB)} orders\n_Significant. Ready to pitch a performance plan._`;
    } else if (b.state === "watch") {
      line = `:warning:  *${b.name}* — control is ahead (${lift}, ${z}).\n_Worth a look before it goes in front of the client._`;
    } else if (b.ordersB >= MIN_CONTROL_ORDERS) {
      line = `:hourglass_flowing_sand:  *${b.name}* — ${lift} so far, not yet conclusive · ${num(b.ordersA + b.ordersB)} orders\n_Keep it running._`;
    } else {
      // Too few control orders for a percentage to mean anything — quoting one
      // here is how a +572% off 2 orders ends up in front of a client.
      line = `:hourglass_flowing_sand:  *${b.name}* — gathering evidence · ${num(b.ordersA + b.ordersB)} orders, control needs ~${MIN_CONTROL_ORDERS}\n_Too early to read a lift._`;
    }
    blocks.push({
      type: "section",
      text: mrkdwn(line),
      ...(b.shareToken
        ? { accessory: linkButton("Dashboard", `${origin}/share/${b.shareToken}`, b.state === "ready" ? "primary" : undefined) }
        : {}),
    });
  }
  // Anything past the row cap still gets counted — a silent truncation would
  // read as "that's everything" when it isn't.
  const hidden = d.pipeline.filter((b) => b.state !== "quiet").length - shown.length;
  const tailParts: string[] = [];
  if (hidden > 0) tailParts.push(`${hidden} more running below the cut`);
  if (quiet.length > 0) {
    tailParts.push(
      `${quiet.length} still gathering traffic (${quiet.slice(0, 4).map((b) => b.name).join(", ")}${quiet.length > 4 ? "…" : ""})`,
    );
  }
  if (tailParts.length > 0) {
    blocks.push({ type: "context", elements: [mrkdwn(`_${tailParts.join(" · ")}._`)] });
  }

  // ---- On plan: live money ----
  if (d.plan.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({ type: "section", text: mrkdwn("*On a performance plan*") });
    for (const p of d.plan) {
      const closes = p.periodEnd ? ` · period closes ${p.periodEnd.slice(5, 10).replace("-", "/")}` : "";
      const lift = p.liftPct != null ? ` · ${p.liftPct >= 0 ? "+" : ""}${p.liftPct.toFixed(0)}% lift` : "";
      blocks.push({
        type: "section",
        text: mrkdwn(`:moneybag:  *${p.name}* — *${money(p.accruingCents)}* accruing this period${closes}${lift}`),
        accessory: linkButton("Billing", `${origin}/admin/billing`),
      });
    }
  }

  // ---- Follow-ups: conversations where the client spoke last ----
  if (d.followUps.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: mrkdwn(
        `*Waiting on you* · ${d.followUps.length} client conversation${d.followUps.length === 1 ? "" : "s"} where they spoke last`,
      ),
    });
    for (const f of d.followUps.slice(0, MAX_FOLLOWUP_ROWS)) {
      const urgency = f.hoursWaiting >= 48 ? ":exclamation:" : ":speech_balloon:";
      const who = f.lastSpeaker ? `*${f.lastSpeaker}*` : "They";
      const asked = f.isQuestion ? "asked" : "wrote";
      blocks.push({
        type: "section",
        text: mrkdwn(
          `${urgency}  *#${f.channel}* — ${who} ${asked} ${formatWaiting(f.hoursWaiting)} ago${f.excerpt ? `\n_“${f.excerpt}”_` : ""}`,
        ),
        // app_redirect opens the channel in whichever Slack client they're on,
        // without needing the team id baked into the link.
        accessory: linkButton(
          "Reply",
          `https://slack.com/app_redirect?channel=${f.channelId}`,
          f.hoursWaiting >= 48 ? "danger" : undefined,
        ),
      });
    }
    if (d.followUps.length > MAX_FOLLOWUP_ROWS) {
      blocks.push({
        type: "context",
        elements: [
          mrkdwn(`_+${d.followUps.length - MAX_FOLLOWUP_ROWS} more channels waiting on a reply._`),
        ],
      });
    }
  }

  // ---- Partners + footer ----
  if (d.partners.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        mrkdwn(
          `*Partners:* ${d.partners
            .map(
              (p) =>
                `${p.name} — ${money(p.earnedCents)} earned${p.pendingCents > 0 ? `, ${money(p.pendingCents)} pending` : ""} (${p.brands} brand${p.brands === 1 ? "" : "s"})`,
            )
            .join("  ·  ")}`,
        ),
      ],
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "actions",
    elements: [
      linkButton("Admin", `${origin}/admin`),
      linkButton("Health", `${origin}/admin/health`),
      linkButton("Billing", `${origin}/admin/billing`),
      linkButton("Share links", `${origin}/admin/links`),
    ],
  });

  return blocks;
}

/** Plain-text fallback shown in notifications and unfurled previews. */
export function digestSummaryText(d: Digest): string {
  if (d.attention.length === 0) {
    return `Daily digest — all clear. ${money(d.totals.revenueCents)} tracked in 24h across ${d.totals.brands} brands.`;
  }
  return `Daily digest — ${d.attention.length} item${d.attention.length === 1 ? "" : "s"} need attention.`;
}
