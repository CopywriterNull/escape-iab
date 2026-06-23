import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { InstallCheck } from "./_components/install-check";
import { RollupRefreshButton } from "./_components/rollup-refresh-button";
import { MerchantRefreshButton } from "./_components/merchant-refresh-button";

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

type EventCounts = {
  impressions: number;
  igImpressions: number;
  escapes: number;
  checkouts: number;
  addToCarts: number;
  purchases: number;
  productViewed: number;
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

const SAMPLE_LIMIT = 500;

export default async function AdminHealth() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return (
      <div className="rounded-xl border border-[var(--color-danger)]/35 bg-[var(--color-danger-soft)]/30 p-6">
        <div className="eyebrow">Admin · Health</div>
        <h1 className="mt-2 h-display text-[24px] tracking-tight">Service role unavailable</h1>
        <p className="mt-2 text-[13px] text-[var(--color-fg-dim)]">
          Set <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to run cross-merchant health checks.
        </p>
      </div>
    );
  }
  const { data: merchantData, error: merchantError } = await admin
    .from("merchants")
    .select("id,name,domain,shopify_domain,escape_enabled,ab_enabled,paid_only,escape_instagram,escape_threads,escape_facebook,escape_messenger,escape_discord,created_at")
    .order("created_at", { ascending: false });

  if (merchantError) {
    return <HealthError title="Could not load merchants" message={merchantError.message} />;
  }

  const merchants = (merchantData ?? []) as MerchantRow[];
  const since30 = new Date(new Date().getTime() - 30 * 86400_000).toISOString();
  const summaries = await Promise.all(
    merchants.map(async (merchant) => {
      const health = await loadMerchantHealth(admin, merchant.id, since30);
      return summarize(merchant, health.events, health.counts, health.latestRollupHour, health.error);
    }),
  );
  const redCount = summaries.filter((s) => s.tone === "danger").length;
  const warnCount = summaries.filter((s) => s.tone === "warn").length;
  const liveCount = summaries.filter((s) => s.tone === "success").length;
  const totalRecentEvents = summaries.reduce((sum, s) => sum + s.recentCount, 0);
  const staleRollups = summaries.filter((s) => s.rollupStale);

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Admin · Health</div>
          <h1 className="mt-2 h-display text-[28px] tracking-tight">Install health center</h1>
          <p className="mt-1 text-[13px] text-[var(--color-fg-dim)] max-w-2xl">
            One place to check whether each merchant is installed, emitting IG traffic, sending pixel events, and attributing purchases.
          </p>
          <p className="mt-2 text-[11px] font-mono text-[var(--color-fg-muted)]">
            Showing exact 30d counts plus the latest {SAMPLE_LIMIT} relevant rows per merchant · {totalRecentEvents.toLocaleString()} sampled rows loaded
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
          <RollupRefreshButton />
          <Link
            href="/admin/simulator"
            className="hidden h-9 items-center rounded-md border border-[var(--color-border)] px-3 text-[12px] font-medium hover:bg-[var(--color-bg-elev)] focus-ring sm:inline-flex"
          >
            Open simulator
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Healthy" value={liveCount.toString()} tone="success" />
        <Stat label="Watch" value={warnCount.toString()} tone="warn" />
        <Stat label="Needs fix" value={redCount.toString()} tone="danger" />
      </div>

      {staleRollups.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-danger)]/35 bg-[var(--color-danger-soft)]/30 px-4 py-3">
          <div className="text-[12px] font-semibold text-[var(--color-danger)]">
            {staleRollups.length} merchant{staleRollups.length === 1 ? "" : "s"} with stale rollups
          </div>
          <div className="mt-1 text-[11.5px] text-[var(--color-fg-dim)]">
            Live traffic is outrunning the hourly rollups for{" "}
            {staleRollups.map((s) => s.merchant.name ?? s.merchant.id).join(", ")}. Hit{" "}
            <span className="font-mono">Roll up last 24h</span> above, or check the retention cron — this is the signal that froze 2026-06-15.
          </div>
        </div>
      ) : null}

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
          <MerchantRefreshButton merchantId={merchant.id} />
          <Link href={`/install/${merchant.id}`} className="text-[12px] rounded-md border border-[var(--color-border)] px-2.5 py-1.5 hover:bg-[var(--color-bg-elev)]">
            Install guide
          </Link>
          <Link href={`/admin/merchants`} className="text-[12px] rounded-md border border-[var(--color-border)] px-2.5 py-1.5 hover:bg-[var(--color-bg-elev)]">
            Merchant row
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <InstallCheck domain={merchant.domain} merchantId={merchant.id} />
        <CheckTile
          label="Last IG impression"
          tone={summary.lastIgImpression ? "success" : "warn"}
          value={summary.lastIgImpression ? ago(summary.lastIgImpression.created_at) : "none in 30d"}
          detail={
            summary.lastIgImpression
              ? "Snippet is firing on Instagram"
              : summary.lastAnyEvent
                ? `Latest event: ${summary.lastAnyEvent.event_type} ${ago(summary.lastAnyEvent.created_at)}`
                : "Open a real IG link or check install"
          }
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
        <CheckTile
          label="Rollup freshness"
          tone={summary.rollupTone}
          value={summary.rollupLabel}
          detail={summary.rollupDetail}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Escapes 30d" value={summary.escapeCount.toString()} />
        <MiniMetric label="IG imps 30d" value={summary.igImpressionCount.toString()} />
        <MiniMetric label="Checkouts 30d" value={summary.checkoutCount.toString()} />
        <MiniMetric label="Purchases 30d" value={summary.purchaseCount.toString()} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="All imps 30d" value={summary.impressionCount.toString()} />
        <MiniMetric label="ATC 30d" value={summary.addToCartCount.toString()} />
        <MiniMetric label="Latest sample" value={`${summary.recentCount}/${SAMPLE_LIMIT}`} />
      </div>
      {summary.dataError ? (
        <div className="mt-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/30 px-3 py-2 text-[12px] text-[var(--color-danger)]">
          Supabase data issue: {summary.dataError}
        </div>
      ) : null}
    </section>
  );
}

type HealthSummary = ReturnType<typeof summarize>;

function summarize(
  merchant: MerchantRow,
  events: EventRow[],
  counts: EventCounts,
  latestRollupHour: string | null,
  dataError: string | null,
) {
  const lastIgImpression = events.find((e) => e.event_type === "impression" && e.iab_kind === "instagram") ?? null;
  const lastPixelEvent =
    events.find((e) => e.event_type === "checkout_started" || e.event_type === "add_to_cart") ?? null;
  const lastProductViewed = events.find((e) => e.event_type === "product_viewed") ?? null;
  const lastPurchase = events.find((e) => e.event_type === "purchase") ?? null;
  const attributedPurchase = events.find(
    (e) => e.event_type === "purchase" && (e.in_test === true || !!e.cart_token || !!e.order_id),
  ) ?? null;
  const lastAnyEvent = events[0] ?? null;

  const pixelTone: Tone = lastPixelEvent || lastProductViewed ? "success" : "muted";
  const pixelLabel = lastPixelEvent
    ? ago(lastPixelEvent.created_at)
    : lastProductViewed
      ? `${counts.productViewed} product views`
      : "No pixel events";
  const pixelDetail = lastPixelEvent
      ? "Checkout/ATC pixel is firing"
      : lastProductViewed
        ? "Product view pixel is firing"
      : "Waiting for add-to-cart or checkout";

  const purchaseTone: Tone = attributedPurchase ? "success" : lastPurchase ? "warn" : "muted";
  const purchaseLabel = attributedPurchase ? ago(attributedPurchase.created_at) : lastPurchase ? "Unattributed" : "No purchases";
  const purchaseDetail = attributedPurchase
    ? "Purchase rows are joining"
    : lastPurchase
      ? "Purchase seen, join needs review"
      : "Waiting for webhook/order event";

  // Rollup freshness: compare this merchant's newest rolled-up hour against its
  // newest live event. A merchant with recent traffic whose rollups lag well
  // behind = the refresh/cron isn't keeping up (the failure mode that silently
  // froze rollups 2026-06-15 -> 2026-06-23). Quiet merchants legitimately have
  // no recent rollup rows, so only flag when there IS recent traffic.
  const latestEventTime = lastAnyEvent ? new Date(lastAnyEvent.created_at).getTime() : null;
  const latestRollupTime = latestRollupHour ? new Date(latestRollupHour).getTime() : null;
  const hasRecentTraffic = latestEventTime != null && Date.now() - latestEventTime < 24 * 3600_000;
  const rollupGapHours =
    latestEventTime != null && latestRollupTime != null
      ? (latestEventTime - latestRollupTime) / 3600_000
      : null;
  let rollupTone: Tone = "muted";
  let rollupLabel = "No rollups yet";
  let rollupDetail = "No hourly rollup rows for this merchant";
  let rollupStale = false;
  if (latestRollupTime != null) {
    rollupLabel = ago(latestRollupHour as string);
    if (hasRecentTraffic && rollupGapHours != null && rollupGapHours > 2) {
      rollupTone = "danger";
      rollupStale = true;
      rollupDetail = `${Math.round(rollupGapHours)}h behind live events — refresh/cron lag`;
    } else {
      rollupTone = "success";
      rollupDetail = "Rollups current with live events";
    }
  } else if (hasRecentTraffic) {
    rollupTone = "danger";
    rollupStale = true;
    rollupDetail = "Live traffic but no rollups — cron not running";
  }

  let tone: Exclude<Tone, "muted"> = "success";
  let label = "Healthy";
  if (dataError) {
    tone = "danger";
    label = "Data issue";
  } else if (merchant.escape_enabled === false) {
    tone = "danger";
    label = "Paused";
  } else if (!merchant.domain || !lastIgImpression) {
    tone = "warn";
    label = "Needs traffic";
  } else if (lastPurchase && !attributedPurchase) {
    tone = "warn";
    label = "Review";
  }

  return {
    merchant,
    events,
    tone,
    label,
    lastIgImpression,
    lastAnyEvent,
    recentCount: events.length,
    impressionCount: counts.impressions,
    igImpressionCount: counts.igImpressions,
    escapeCount: counts.escapes,
    checkoutCount: counts.checkouts,
    addToCartCount: counts.addToCarts,
    purchaseCount: counts.purchases,
    productViewedCount: counts.productViewed,
    pixelTone,
    pixelLabel,
    pixelDetail,
    purchaseTone,
    purchaseLabel,
    purchaseDetail,
    rollupTone,
    rollupLabel,
    rollupDetail,
    rollupStale,
    dataError,
  };
}

async function loadMerchantHealth(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  merchantId: string,
  sinceIso: string,
) {
  const [eventsResult, countsResult, rollupResult] = await Promise.all([
    admin
      .from("escape_events")
      .select("merchant_id,event_type,iab_kind,in_test,order_id,cart_token,created_at")
      .eq("merchant_id", merchantId)
      .in("event_type", EVENT_TYPES)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(SAMPLE_LIMIT),
    loadMerchantCounts(admin, merchantId, sinceIso),
    admin
      .from("hourly_funnel_rollups")
      .select("hour,refreshed_at")
      .eq("merchant_id", merchantId)
      .order("hour", { ascending: false })
      .limit(1),
  ]);

  const eventError = eventsResult.error?.message ?? null;
  const countError = countsResult.error;
  const latestRollup = ((rollupResult.data ?? []) as { hour: string | null; refreshed_at: string | null }[])[0] ?? null;

  return {
    events: ((eventsResult.data ?? []) as EventRow[]),
    counts: countsResult.counts,
    latestRollupHour: latestRollup?.hour ?? null,
    error: eventError ?? countError,
  };
}

async function loadMerchantCounts(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  merchantId: string,
  sinceIso: string,
): Promise<{ counts: EventCounts; error: string | null }> {
  const count = async (eventType: string, iabKind?: string) => {
    let query = admin
      .from("escape_events")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("event_type", eventType)
      .gte("created_at", sinceIso);

    if (iabKind) query = query.eq("iab_kind", iabKind);
    const { count: n, error } = await query;
    return { count: n ?? 0, error: error?.message ?? null };
  };

  const [impressions, igImpressions, escapes, checkouts, addToCarts, purchases, productViewed] =
    await Promise.all([
      count("impression"),
      count("impression", "instagram"),
      count("escape_attempt"),
      count("checkout_started"),
      count("add_to_cart"),
      count("purchase"),
      count("product_viewed"),
    ]);

  return {
    counts: {
      impressions: impressions.count,
      igImpressions: igImpressions.count,
      escapes: escapes.count,
      checkouts: checkouts.count,
      addToCarts: addToCarts.count,
      purchases: purchases.count,
      productViewed: productViewed.count,
    },
    error:
      impressions.error ??
      igImpressions.error ??
      escapes.error ??
      checkouts.error ??
      addToCarts.error ??
      purchases.error ??
      productViewed.error,
  };
}

function HealthError({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-danger)]/35 bg-[var(--color-danger-soft)]/30 p-6">
      <div className="eyebrow">Admin · Health</div>
      <h1 className="mt-2 h-display text-[24px] tracking-tight">{title}</h1>
      <p className="mt-2 text-[13px] text-[var(--color-fg-dim)]">{message}</p>
    </div>
  );
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
