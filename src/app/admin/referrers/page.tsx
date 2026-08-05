import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  createReferrer,
  updateReferrer,
  deleteReferrer,
  assignMerchantReferrer,
  unassignMerchantReferrer,
  setMerchantReferralPct,
} from "@/app/actions/referrers";
import {
  fetchReferrerEarnings,
  type Referrer,
  type ReferredMerchantRow,
  type ReferrerEarnings,
} from "@/lib/referrals";
import { PartnerLinkButton } from "./_components/partner-link-button";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export const dynamic = "force-dynamic";

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function AdminReferrersPage() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-8 text-sm text-[var(--color-fg-dim)]">
        Set SUPABASE_SERVICE_ROLE_KEY to load referrers.
      </div>
    );
  }

  const [referrersRes, merchantsRes] = await Promise.all([
    admin.from("referrers").select("*").order("created_at", { ascending: true }),
    admin
      .from("merchants")
      .select(
        "id, name, domain, escape_enabled, billing_status, billing_view_token, referral_share_pct, referrer_id, created_at",
      )
      .order("name", { ascending: true }),
  ]);

  if (referrersRes.error || merchantsRes.error) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-8 text-sm text-[var(--color-fg-dim)]">
        {referrersRes.error?.message ?? merchantsRes.error?.message}
      </div>
    );
  }

  const referrers = (referrersRes.data ?? []) as Referrer[];
  const merchants = (merchantsRes.data ?? []) as ReferredMerchantRow[];
  const unassigned = merchants.filter((m) => !m.referrer_id);

  const earningsByReferrer = new Map<string, ReferrerEarnings | null>();
  await Promise.all(
    referrers.map(async (r) => {
      try {
        earningsByReferrer.set(
          r.id,
          await fetchReferrerEarnings(admin, r, merchants.filter((m) => m.referrer_id === r.id)),
        );
      } catch {
        earningsByReferrer.set(r.id, null);
      }
    }),
  );

  const totalPaidShare = [...earningsByReferrer.values()].reduce(
    (n, e) => n + (e?.paidShareCents ?? 0),
    0,
  );

  return (
    <div className="space-y-7">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="eyebrow">Admin · Referrals</div>
          <h1 className="mt-2 h-display text-[28px] tracking-tight">Referral partners</h1>
          <p className="mt-1 text-[12px] text-[var(--color-fg-muted)] font-mono">
            {referrers.length} partners · {merchants.filter((m) => m.referrer_id).length} referred
            brands · {money(totalPaidShare)} owed on collected billing (all-time)
          </p>
        </div>
      </div>

      <form
        action={createReferrer}
        className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5 space-y-4"
      >
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
          New partner
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            type="text"
            name="name"
            placeholder="Partner name"
            required
            maxLength={80}
            className="px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
          />
          <input
            type="email"
            name="email"
            placeholder="email (optional)"
            maxLength={120}
            className="px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm font-mono focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
          />
          <input
            type="number"
            name="default_share_pct"
            placeholder="default share % (20)"
            min={0}
            max={100}
            step="0.5"
            className="px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm font-mono focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          Create partner
        </button>
        <p className="text-[11px] text-[var(--color-fg-muted)] font-mono">
          Share % applies to collected (paid) invoices from their referred brands. Per-brand
          overrides available after assignment.
        </p>
      </form>

      <div className="space-y-3">
        {referrers.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-8 text-sm text-[var(--color-fg-dim)]">
            No partners yet — create one above, assign brands, then send them their partner link.
          </div>
        ) : null}
        {referrers.map((r) => (
          <ReferrerCard
            key={r.id}
            referrer={r}
            earnings={earningsByReferrer.get(r.id) ?? null}
            unassigned={unassigned}
          />
        ))}
      </div>
    </div>
  );
}

function ReferrerCard({
  referrer,
  earnings,
  unassigned,
}: {
  referrer: Referrer;
  earnings: ReferrerEarnings | null;
  unassigned: ReferredMerchantRow[];
}) {
  const assignedCount = earnings?.merchants.length ?? 0;
  return (
    <details className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
      <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between gap-4 hover:bg-[var(--color-bg-elev)]/40">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium tracking-tight">{referrer.name}</span>
            {referrer.email ? (
              <span className="text-[12.5px] font-mono text-[var(--color-fg-dim)]">{referrer.email}</span>
            ) : null}
            <span className="pill pill-info">{Number(referrer.default_share_pct)}% default</span>
            <span className="pill pill-muted">
              {assignedCount} brand{assignedCount === 1 ? "" : "s"}
            </span>
            {earnings ? (
              <>
                <span className="pill pill-success">earned {money(earnings.paidShareCents)}</span>
                {earnings.pendingShareCents > 0 ? (
                  <span className="pill pill-warn">pending {money(earnings.pendingShareCents)}</span>
                ) : null}
              </>
            ) : (
              <span className="pill pill-danger">earnings unavailable</span>
            )}
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--color-fg-muted)] tnum">
            {referrer.id} · created {new Date(referrer.created_at).toLocaleDateString()}
          </div>
        </div>
        <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">expand ▾</span>
      </summary>

      <div className="border-t border-[var(--color-border-soft)] p-5 space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <PartnerLinkButton referrerId={referrer.id} />
          <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">
            Read-only dashboard: their brands, collected billing, and their {""}
            cut. No login needed.
          </span>
        </div>

        <form action={updateReferrer} className="grid sm:grid-cols-[1fr_1fr_120px_auto] gap-2 items-end">
          <input type="hidden" name="id" value={referrer.id} />
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Name
            </label>
            <input
              type="text"
              name="name"
              required
              maxLength={80}
              defaultValue={referrer.name}
              className="mt-1.5 w-full px-3 py-2 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Email
            </label>
            <input
              type="email"
              name="email"
              maxLength={120}
              defaultValue={referrer.email ?? ""}
              className="mt-1.5 w-full px-3 py-2 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] font-mono focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Default %
            </label>
            <input
              type="number"
              name="default_share_pct"
              min={0}
              max={100}
              step="0.5"
              defaultValue={Number(referrer.default_share_pct)}
              className="mt-1.5 w-full px-3 py-2 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] font-mono focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="h-[34px] text-[12px] px-3 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] press transition-colors"
          >
            Save
          </button>
        </form>

        <form action={assignMerchantReferrer} className="grid sm:grid-cols-[1fr_160px_auto] gap-2 items-end">
          <input type="hidden" name="referrer_id" value={referrer.id} />
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Assign a brand
            </label>
            <select
              name="merchant_id"
              required
              defaultValue=""
              className="mt-1.5 w-full px-3 py-2 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            >
              <option value="" disabled>
                {unassigned.length > 0 ? "Select unassigned brand…" : "No unassigned brands"}
              </option>
              {unassigned.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? "(unnamed)"} — {m.domain ?? m.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Override % (opt)
            </label>
            <input
              type="number"
              name="referral_share_pct"
              min={0}
              max={100}
              step="0.5"
              placeholder={`${Number(referrer.default_share_pct)}`}
              className="mt-1.5 w-full px-3 py-2 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] font-mono focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="h-[34px] text-[12px] px-3 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] press transition-colors"
          >
            Assign
          </button>
        </form>

        {earnings && earnings.merchants.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border-soft)]">
                <tr>
                  <th className="text-left py-2 pr-3">Brand</th>
                  <th className="text-right py-2 pr-3">Share %</th>
                  <th className="text-right py-2 pr-3">Collected</th>
                  <th className="text-right py-2 pr-3">Their cut</th>
                  <th className="text-right py-2 pr-3">Pending cut</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {earnings.merchants.map(({ merchant: m, effectivePct, paidTotalCents, paidShareCents, pendingShareCents }) => (
                  <tr key={m.id} className="border-b border-[var(--color-border-soft)]/60 last:border-b-0">
                    <td className="py-2.5 pr-3 align-middle">
                      <div className="font-medium tracking-tight">{m.name ?? "(unnamed)"}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
                        {m.domain ?? m.id.slice(0, 8)} · billing {m.billing_status}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 align-middle text-right">
                      <form action={setMerchantReferralPct} className="inline-flex items-center gap-1.5 justify-end">
                        <input type="hidden" name="merchant_id" value={m.id} />
                        <input
                          type="number"
                          name="referral_share_pct"
                          min={0}
                          max={100}
                          step="0.5"
                          defaultValue={m.referral_share_pct != null ? Number(m.referral_share_pct) : ""}
                          placeholder={`${Number(referrer.default_share_pct)}`}
                          className="w-[70px] px-2 py-1 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[11.5px] font-mono text-right focus-ring transition-colors"
                        />
                        <button
                          type="submit"
                          className="text-[11px] px-2 py-1 rounded-md border border-[var(--color-border-soft)] hover:bg-[var(--color-bg-elev)] press transition-colors"
                        >
                          Set
                        </button>
                      </form>
                      <div className="mt-0.5 text-[10px] font-mono text-[var(--color-fg-muted)]">
                        effective {effectivePct}%
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 align-middle text-right font-mono tnum text-[var(--color-fg-dim)]">
                      {money(paidTotalCents)}
                    </td>
                    <td className="py-2.5 pr-3 align-middle text-right font-mono tnum font-semibold text-[var(--color-success)]">
                      {money(paidShareCents)}
                    </td>
                    <td className="py-2.5 pr-3 align-middle text-right font-mono tnum text-[var(--color-fg-dim)]">
                      {pendingShareCents > 0 ? money(pendingShareCents) : "—"}
                    </td>
                    <td className="py-2.5 align-middle text-right whitespace-nowrap">
                      {m.billing_view_token ? (
                        <a
                          href={`/share/${m.billing_view_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-2 text-[11px] font-medium text-[var(--color-accent)] hover:underline underline-offset-2"
                        >
                          Dashboard ↗
                        </a>
                      ) : null}
                      <form action={unassignMerchantReferrer} className="inline">
                        <input type="hidden" name="merchant_id" value={m.id} />
                        <ConfirmSubmitButton
                          message={`Unassign "${m.name ?? m.id}" from ${referrer.name}? Their cut stops accruing for this brand.`}
                          className="text-[11px] px-2 py-1 rounded-md border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] press transition-colors"
                        >
                          Unassign
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-[12px] text-[var(--color-fg-dim)]">No brands assigned yet.</div>
        )}

        <form action={deleteReferrer}>
          <input type="hidden" name="id" value={referrer.id} />
          <ConfirmSubmitButton
            message={`Delete partner "${referrer.name}"? Their brands detach and their earnings attribution history is lost. This cannot be undone.`}
            className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] press transition-colors"
          >
            Delete partner
          </ConfirmSubmitButton>
        </form>
      </div>
    </details>
  );
}
