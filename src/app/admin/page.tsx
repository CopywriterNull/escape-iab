import { redirect } from "next/navigation";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import {
  createMerchantAsAdmin,
  deleteMerchantAsAdmin,
  assignMerchantToCurrentUser,
  impersonateMerchant,
} from "@/app/actions/admin";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "lennyhuynh526@gmail.com";

type Row = {
  id: string;
  name: string | null;
  domain: string | null;
  user_id: string | null;
  plan: string;
  created_at: string;
};

export default async function AdminMerchants() {
  const supabase = await getSupabaseServer();
  if (!supabase) return <Locked reason="Backend not configured" />;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return <Locked reason={`Admin only. Signed in as ${user.email}.`} />;
  }

  const admin = getSupabaseAdmin();
  if (!admin) return <Locked reason="Service role not configured" />;
  const { data } = await admin
    .from("merchants")
    .select("id, name, domain, user_id, plan, created_at")
    .order("created_at", { ascending: false });
  const rows: Row[] = (data as Row[]) ?? [];

  // Pull last-24h event counts per merchant for tracking status at a glance.
  const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
  const eventCounts = new Map<string, number>();
  const eventLastSeen = new Map<string, string>();
  if (rows.length > 0) {
    const { data: events } = await admin
      .from("escape_events")
      .select("merchant_id, created_at")
      .gte("created_at", since24)
      .in("merchant_id", rows.map((r) => r.id));
    for (const e of (events ?? []) as { merchant_id: string; created_at: string }[]) {
      eventCounts.set(e.merchant_id, (eventCounts.get(e.merchant_id) ?? 0) + 1);
      const prev = eventLastSeen.get(e.merchant_id);
      if (!prev || e.created_at > prev) eventLastSeen.set(e.merchant_id, e.created_at);
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="eyebrow">Admin</div>
            <h1 className="mt-2 h-display text-[32px] tracking-tight">Merchants</h1>
            <p className="mt-1 text-[12.5px] text-[var(--color-fg-muted)] font-mono">
              {rows.length} total · signed in as {user.email}
            </p>
          </div>
          <a
            href="/dashboard"
            className="text-[12px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← dashboard
          </a>
        </div>

        {/* Create form */}
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

        {/* Rows */}
        <div className="space-y-3">
          {rows.map((r) => (
            <MerchantRow
              key={r.id}
              row={r}
              myUserId={user.id}
              eventsLast24h={eventCounts.get(r.id) ?? 0}
              lastSeen={eventLastSeen.get(r.id) ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
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
  const snippet = `<script src="https://escape-iab.vercel.app/s/${row.id}.js?v=9"></script>`;
  const tracking = eventsLast24h > 0;
  const lastSeenLabel = lastSeen
    ? `${Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000)}m ago`
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
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)] mb-1.5">
            Install snippet
          </div>
          <pre className="text-[11.5px] font-mono bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <div className="mt-1.5 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
            Paste in their theme.liquid &lt;head&gt;, no async. Bump ?v= to bust their cache after settings changes.
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <form action={impersonateMerchant}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className="text-[12px] px-3 py-1.5 rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] font-medium press lift focus-ring transition-colors"
            >
              View as →
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

function Locked({ reason }: { reason: string }) {
  return (
    <div className="min-h-dvh grid place-items-center px-5 bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="max-w-md p-8 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)]">
        <h1 className="h-display text-[24px] tracking-tight">Admin only</h1>
        <p className="mt-2 text-[13px] text-[var(--color-fg-dim)]">{reason}</p>
        <a
          href="/dashboard"
          className="mt-4 inline-block text-sm text-[var(--color-accent)] link-grow"
        >
          ← dashboard
        </a>
      </div>
    </div>
  );
}
