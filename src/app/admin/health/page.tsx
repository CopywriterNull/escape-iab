import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { InstallCheck } from "./_components/install-check";

export const dynamic = "force-dynamic";

type MerchantRow = {
  id: string;
  name: string | null;
  domain: string | null;
  shopify_domain: string | null;
  escape_enabled: boolean | null;
  ab_enabled: boolean | null;
  paid_only: boolean | null;
  escape_instagram: boolean | null;
  escape_threads: boolean | null;
  escape_facebook: boolean | null;
  escape_messenger: boolean | null;
  escape_discord: boolean | null;
  created_at: string;
};

type EventRow = {
  merchant_id: string;
  event_type: string;
  iab_kind: string | null;
  in_test: boolean | null;
  order_id: string | null;
  cart_token: string | null;
  created_at: string;
};

type Tone = "success" | "warn" | "danger" | "muted";

const EVENT_TYPES = [
  "impression",
  "escape_attempt",
  "checkout_started",
  "add_to_cart",
  "purchase",
  "product_viewed",
];

export default async function AdminHealth() {
  const admin = getSupabaseAdmin();
  const { data: merchantData } = await admin!
    .from("merchants")
    .select("id,name,domain,shopify_domain,escape_enabled,ab_enabled,paid_only,escape_instagram,escape_threads,escape_facebook,escape_messenger,escape_discord,created_at")
    .order("created_at", { ascending: false });

  const merchants = (merchantData ?? []) as MerchantRow[];
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const eventsByMerchant = new Map<string, EventRow[]>();

  if (merchants.length > 0) {
    const { data: eventData } = await admin!
      .from("escape_events")
      .select("merchant_id,event_type,iab_kind,in_test,order_id,cart_token,created_at")
      .in("merchant_id", merchants.map((m) => m.id))
      .in("event_type", EVENT_TYPES)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(8000);

    for (const event of (eventData ?? []) as EventRow[]) {
      const rows = eventsByMerchant.get(event.merchant_id) ?? [];
      rows.push(event);
      eventsByMerchant.set(event.merchant_id, rows);
    }
  }

  const summaries = merchants.map((merchant) => summarize(merchant, eventsByMerchant.get(merchant.id) ?? []));
  const redCount = summaries.filter((s) => s.tone === "danger").length;
  const warnCount = summaries.filter((s) => s.tone === "warn").length;
  const liveCount = summaries.filter((s) => s.tone === "success").length;

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Admin · Health</div>
          <h1 className="mt-2 h-display text-[28px] tracking-tight">Install health center</h1>
          <p className="mt-1 text-[13px] text-[var(--color-fg-dim)] max-w-2xl">
            One place to check whether each merchant is installed, emitting IG traffic, sending pixel events, and attributing purchases.
          </p>
        </div>
        <Link
          href="/admin/simulator"
          className="hidden sm:inline-flex h-9 items-center rounded-md border border-[var(--color-border)] px-3 text-[12px] font-medium hover:bg-[var(--color-bg-elev)] focus-ring"
        >
          Open simulator
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Healthy" value={liveCount.toString()} tone="success" />
        <Stat label="Watch" value={warnCount.toString()} tone="warn" />
        <Stat label="Needs fix" value={redCount.toString()} tone="danger" />
      </div>

      <div className="space-y-3">
        {summaries.map((summary) => (
          <MerchantHealthCard key={summary.merchant.id} summary={summary} />
        ))}
      </div>
    </div>
  );
}

function MerchantHealthCard({ summary }: { summary: HealthSummary }) {
  const { merchant } = summary;
  return (
    <section className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold tracking-tight">{merchant.name ?? "(unnamed)"}</span>
            <HealthPill tone={summary.tone} label={summary.label} />
            <span className="pill pill-muted">{platformScope(merchant)}</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--color-fg-muted)] truncate">
            {merchant.domain ?? "no domain"} · {merchant.id}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/install/${merchant.id}`} className="text-[12px] rounded-md border border-[var(--color-border)] px-2.5 py-1.5 hover:bg-[var(--color-bg-elev)]">
            Install guide
          </Link>
          <Link href={`/admin/merchants`} className="text-[12px] rounded-md border border-[var(--color-border)] px-2.5 py-1.5 hover:bg-[var(--color-bg-elev)]">
            Merchant row
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <InstallCheck domain={merchant.domain} merchantId={merchant.id} />
        <CheckTile
          label="Last IG impression"
          tone={summary.lastIgImpression ? "success" : "warn"}
          value={summary.lastIgImpression ? ago(summary.lastIgImpression.created_at) : "none in 30d"}
          detail={summary.lastIgImpression ? "Snippet is firing on Instagram" : "Open a real IG link or check install"}
        />
        <CheckTile
          label="Pixel"
          tone={summary.pixelTone}
          value={summary.pixelLabel}
          detail={summary.pixelDetail}
        />
        <CheckTile
          label="Purchase attribution"
          tone={summary.purchaseTone}
          value={summary.purchaseLabel}
          detail={summary.purchaseDetail}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Escapes 30d" value={summary.escapeCount.toString()} />
        <MiniMetric label="Checkouts 30d" value={summary.checkoutCount.toString()} />
        <MiniMetric label="Purchases 30d" value={summary.purchaseCount.toString()} />
      </div>
    </section>
  );
}

type HealthSummary = ReturnType<typeof summarize>;

function summarize(merchant: MerchantRow, events: EventRow[]) {
  const lastIgImpression = events.find((e) => e.event_type === "impression" && e.iab_kind === "instagram") ?? null;
  const lastPixelEvent =
    events.find((e) => e.event_type === "checkout_started" || e.event_type === "add_to_cart") ?? null;
  const oldPixelEvent = events.find((e) => e.event_type === "product_viewed") ?? null;
  const lastPurchase = events.find((e) => e.event_type === "purchase") ?? null;
  const attributedPurchase = events.find(
    (e) => e.event_type === "purchase" && (e.in_test === true || !!e.cart_token || !!e.order_id),
  ) ?? null;
  const escapeCount = events.filter((e) => e.event_type === "escape_attempt").length;
  const checkoutCount = events.filter((e) => e.event_type === "checkout_started").length;
  const purchaseCount = events.filter((e) => e.event_type === "purchase").length;

  const pixelTone: Tone = oldPixelEvent ? "warn" : lastPixelEvent ? "success" : "muted";
  const pixelLabel = oldPixelEvent ? "Old pixel noise" : lastPixelEvent ? ago(lastPixelEvent.created_at) : "No pixel events";
  const pixelDetail = oldPixelEvent
    ? "product_viewed seen recently"
    : lastPixelEvent
      ? "Checkout/ATC pixel is firing"
      : "Waiting for add-to-cart or checkout";

  const purchaseTone: Tone = attributedPurchase ? "success" : lastPurchase ? "warn" : "muted";
  const purchaseLabel = attributedPurchase ? ago(attributedPurchase.created_at) : lastPurchase ? "Unattributed" : "No purchases";
  const purchaseDetail = attributedPurchase
    ? "Purchase rows are joining"
    : lastPurchase
      ? "Purchase seen, join needs review"
      : "Waiting for webhook/order event";

  let tone: Exclude<Tone, "muted"> = "success";
  let label = "Healthy";
  if (merchant.escape_enabled === false) {
    tone = "danger";
    label = "Paused";
  } else if (!merchant.domain || !lastIgImpression) {
    tone = "warn";
    label = "Needs traffic";
  } else if (oldPixelEvent || (lastPurchase && !attributedPurchase)) {
    tone = "warn";
    label = "Review";
  }

  return {
    merchant,
    events,
    tone,
    label,
    lastIgImpression,
    escapeCount,
    checkoutCount,
    purchaseCount,
    pixelTone,
    pixelLabel,
    pixelDetail,
    purchaseTone,
    purchaseLabel,
    purchaseDetail,
  };
}

function CheckTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/35 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div className={`mt-1 text-[12px] font-medium ${toneClass(tone)}`}>{value}</div>
      <div className="mt-1 truncate text-[11px] text-[var(--color-fg-muted)]" title={detail}>{detail}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-1 text-[16px] font-mono tnum">{value}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: Exclude<Tone, "muted"> }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div className={`mt-1 text-[24px] font-mono tnum ${toneClass(tone)}`}>{value}</div>
    </div>
  );
}

function HealthPill({ tone, label }: { tone: Exclude<Tone, "muted">; label: string }) {
  const cls =
    tone === "success"
      ? "pill pill-success"
      : tone === "danger"
        ? "pill pill-warn"
        : "pill pill-info";
  return <span className={cls}>{label}</span>;
}

function toneClass(tone: Tone) {
  if (tone === "success") return "text-[var(--color-success)]";
  if (tone === "danger") return "text-[var(--color-danger)]";
  if (tone === "warn") return "text-[var(--color-accent)]";
  return "text-[var(--color-fg-muted)]";
}

function platformScope(m: MerchantRow) {
  const enabled = [
    m.escape_instagram !== false ? "IG" : null,
    m.escape_threads === true ? "Threads" : null,
    m.escape_facebook === true ? "FB" : null,
    m.escape_messenger === true ? "Messenger" : null,
    m.escape_discord === true ? "Discord" : null,
  ].filter(Boolean);
  return enabled.length > 0 ? enabled.join(" + ") : "No platforms";
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return "30d+";
}
