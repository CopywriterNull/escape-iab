import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import {
  createMerchantAsAdmin,
  deleteMerchantAsAdmin,
  assignMerchantToCurrentUser,
  impersonateMerchant,
  renameMerchantAsAdmin,
  setMerchantShopifyDomain,
  detectMerchantShopifyDomain,
} from "@/app/actions/admin";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string | null;
  domain: string | null;
  shopify_domain: string | null;
  user_id: string | null;
  plan: string;
  created_at: string;
};

type ActivityRow = {
  merchant_id: string;
  events_24h: number | string;
  last_event_at: string | null;
  last_event_type: string | null;
};

export default async function AdminMerchants() {
  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();

  // Auth check and merchants list don't depend on each other — fetch both
  // in parallel. Events query has to wait for rows but is downstream anyway.
  const [authRes, merchantsRes] = await Promise.all([
    supabase!.auth.getUser(),
    admin!
      .from("merchants")
      .select("id, name, domain, shopify_domain, user_id, plan, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const user = authRes.data.user;
  const rows: Row[] = (merchantsRes.data as Row[]) ?? [];

  const eventCounts = new Map<string, number>();
  const eventLastSeen = new Map<string, string>();
  const { data: activity } = await admin!.rpc("eh_admin_merchant_activity_24h");
  for (const row of (activity ?? []) as ActivityRow[]) {
    eventCounts.set(row.merchant_id, toInt(row.events_24h));
    if (row.last_event_at) {
      eventLastSeen.set(row.merchant_id, row.last_event_at);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="eyebrow">Admin · Merchants</div>
          <h1 className="mt-2 h-display text-[28px] tracking-tight">Merchants</h1>
          <p className="mt-1 text-[12px] text-[var(--color-fg-muted)] font-mono">
            {rows.length} total
          </p>
        </div>
      </div>

      <form
        action={createMerchantAsAdmin}
        className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5 space-y-4"
      >
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
          New merchant
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="text"
            name="name"
            placeholder="Store name (e.g. G FUEL)"
            required
            maxLength={80}
            className="px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
          />
          <input
            type="text"
            name="domain"
            placeholder="storedomain.com"
            required
            maxLength={120}
            className="px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm font-mono focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          Create merchant
        </button>
      </form>

      <div className="space-y-3">
        {rows.map((r) => (
          <MerchantRow
            key={r.id}
            row={r}
            myUserId={user!.id}
            eventsLast24h={eventCounts.get(r.id) ?? 0}
            lastSeen={eventLastSeen.get(r.id) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function toInt(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function MerchantRow({
  row,
  myUserId,
  eventsLast24h,
  lastSeen,
}: {
  row: Row;
  myUserId: string;
  eventsLast24h: number;
  lastSeen: string | null;
}) {
  const ownedByMe = row.user_id === myUserId;
  const unowned = !row.user_id;
  const snippet = `<script src="https://getescapehatch.com/s/${row.id}.js?v=12"></script>`;
  const tracking = eventsLast24h > 0;
  const lastSeenLabel = lastSeen
    ? `${Math.floor((new Date().getTime() - new Date(lastSeen).getTime()) / 60000)}m ago`
    : "—";

  return (
    <details className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
      <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between gap-4 hover:bg-[var(--color-bg-elev)]/40">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium tracking-tight">{row.name ?? "(unnamed)"}</span>
            <span className="text-[var(--color-fg-muted)]">·</span>
            <span className="text-[12.5px] font-mono text-[var(--color-fg-dim)]">{row.domain ?? "—"}</span>
            {ownedByMe ? (
              <span className="pill pill-info">YOURS</span>
            ) : unowned ? (
              <span className="pill pill-warn">UNOWNED</span>
            ) : (
              <span className="pill pill-muted">CLIENT</span>
            )}
            <span className={tracking ? "pill pill-success" : "pill pill-muted"}>
              {tracking ? `LIVE · ${eventsLast24h}` : "NO EVENTS 24h"}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--color-fg-muted)] tnum">
            {row.id} · last event {lastSeenLabel} · created {new Date(row.created_at).toLocaleDateString()}
          </div>
        </div>
        <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">expand ▾</span>
      </summary>

      <div className="border-t border-[var(--color-border-soft)] p-5 space-y-4">
        <form action={renameMerchantAsAdmin} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <input type="hidden" name="id" value={row.id} />
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Name
            </label>
            <input
              type="text"
              name="name"
              required
              maxLength={80}
              defaultValue={row.name ?? ""}
              className="mt-1.5 w-full px-3 py-2 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Domain
            </label>
            <input
              type="text"
              name="domain"
              maxLength={120}
              defaultValue={row.domain ?? ""}
              className="mt-1.5 w-full px-3 py-2 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] font-mono focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="h-[34px] text-[12px] px-3 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] press transition-colors"
          >
            Rename
          </button>
        </form>

        <form action={setMerchantShopifyDomain} className="flex items-end gap-2 flex-wrap">
          <input type="hidden" name="id" value={row.id} />
          <div className="flex-1 min-w-[240px]">
            <label className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Shopify admin domain
            </label>
            <input
              type="text"
              name="shopify_domain"
              defaultValue={row.shopify_domain ?? ""}
              placeholder="theirshop.myshopify.com"
              className="mt-1.5 w-full px-3 py-2 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] font-mono focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
            <div className="mt-1 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
              Matches X-Shopify-Shop-Domain on incoming /api/webhooks/shopify/orders requests.
            </div>
          </div>
          <button
            type="submit"
            className="text-[12px] px-3 py-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] press transition-colors"
          >
            Save
          </button>
        </form>
        <form action={detectMerchantShopifyDomain} className="-mt-2">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="domain" value={row.domain ?? ""} />
          <button
            type="submit"
            className="text-[11.5px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline underline-offset-2"
          >
            Detect from public domain
          </button>
        </form>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Install snippet
            </div>
            <span className="text-[10px] font-mono text-[var(--color-fg-muted)]">paste in theme.liquid &lt;head&gt;</span>
          </div>
          <pre className="text-[11.5px] font-mono bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <div className="mt-2 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/40 px-3 py-2 text-[11.5px] flex items-start gap-2">
            <svg viewBox="0 0 16 16" className="size-3.5 text-[var(--color-danger)] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3M8 10.5v0.5" strokeLinecap="round" />
            </svg>
            <div className="text-[var(--color-fg)]">
              <strong className="font-semibold">No <code className="font-mono">async</code> or <code className="font-mono">defer</code>.</strong>{" "}
              <span className="text-[var(--color-fg-dim)]">
                Snippet must run synchronously before paint so the IAB redirect fires before Instagram commits to rendering. Place as the first <code className="font-mono">&lt;script&gt;</code> in <code className="font-mono">&lt;head&gt;</code>.
              </span>
            </div>
          </div>
          <div className="mt-1.5 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
            Bump <code>?v=</code> to bust the edge cache (max-age=300) after settings changes.
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/install/${row.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] px-3 py-1.5 rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] font-medium press lift focus-ring transition-colors"
          >
            Install guide →
          </a>
          <form action={impersonateMerchant}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border-soft)] hover:bg-[var(--color-bg-elev)] press focus-ring transition-colors"
            >
              View as
            </button>
          </form>
          {unowned ? (
            <form action={assignMerchantToCurrentUser}>
              <input type="hidden" name="id" value={row.id} />
              <button
                type="submit"
                className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border-soft)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)] press transition-colors"
              >
                Claim for myself
              </button>
            </form>
          ) : null}
          <form action={deleteMerchantAsAdmin}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] press transition-colors"
            >
              Delete merchant
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}
