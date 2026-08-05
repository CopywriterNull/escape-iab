import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";
import { CASE_STUDIES } from "@/lib/case-studies";
import { CopyButton } from "./_components/copy-button";

export const dynamic = "force-dynamic";

// One page with every shareable URL the operator ever hunts for: per-merchant
// tokened views (share dashboard / billing view / report / install guide),
// partner dashboard links, and the public case studies. Tokens are only
// DISPLAYED here — minting stays on the pages that own the flows
// (/admin/merchants, /admin/billing, /admin/referrers).

type MerchantLinkRow = {
  id: string;
  name: string | null;
  domain: string | null;
  escape_enabled: boolean | null;
  billing_status: string;
  billing_view_token: string | null;
  report_token: string | null;
  referrer_id: string | null;
  created_at: string;
};

type ReferrerRow = {
  id: string;
  name: string;
  view_token: string | null;
};

export default async function AdminLinksPage() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-8 text-sm text-[var(--color-fg-dim)]">
        Set SUPABASE_SERVICE_ROLE_KEY to load links.
      </div>
    );
  }

  const [merchantsRes, referrersRes] = await Promise.all([
    admin
      .from("merchants")
      .select(
        "id, name, domain, escape_enabled, billing_status, billing_view_token, report_token, referrer_id, created_at",
      )
      .order("name", { ascending: true }),
    admin.from("referrers").select("id, name, view_token").order("name", { ascending: true }),
  ]);

  const merchants = (merchantsRes.data ?? []) as MerchantLinkRow[];
  const referrers = (referrersRes.data ?? []) as ReferrerRow[];
  const referrerName = new Map(referrers.map((r) => [r.id, r.name]));
  const origin = siteOrigin();

  return (
    <div className="space-y-7">
      <div>
        <div className="eyebrow">Admin · Links</div>
        <h1 className="mt-2 h-display text-[28px] tracking-tight">Link hub</h1>
        <p className="mt-1 text-[12.5px] text-[var(--color-fg-dim)] max-w-2xl">
          Every shareable URL in one place. Tokened links are public but unguessable — anyone with
          the URL can view (read-only), so share deliberately. Missing tokens are minted from{" "}
          <Link href="/admin/merchants" className="underline underline-offset-2">Merchants</Link>{" "}
          (Copy share link) or{" "}
          <Link href="/admin/referrers" className="underline underline-offset-2">Referrals</Link>{" "}
          (Copy partner link).
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)] flex items-baseline justify-between">
          <span className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Merchant links
          </span>
          <span className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">
            {merchants.length} merchants
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border-soft)]">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Merchant</th>
                <th className="text-left px-3 py-2.5 font-medium">Live dashboard (share)</th>
                <th className="text-left px-3 py-2.5 font-medium">Billing view</th>
                <th className="text-left px-3 py-2.5 font-medium">Report</th>
                <th className="text-left px-5 py-2.5 font-medium">Install guide</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m) => {
                const share = m.billing_view_token ? `${origin}/share/${m.billing_view_token}` : null;
                const billing = m.billing_view_token
                  ? `${origin}/billing/view/${m.billing_view_token}`
                  : null;
                const report = m.report_token ? `${origin}/r/${m.report_token}` : null;
                const install = `${origin}/install/${m.id}`;
                return (
                  <tr key={m.id} className="border-b border-[var(--color-border-soft)]/60 last:border-b-0 align-middle">
                    <td className="px-5 py-2.5">
                      <div className="font-medium tracking-tight whitespace-nowrap">
                        {m.name ?? "(unnamed)"}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
                        {m.domain ?? "—"}
                        {m.referrer_id ? (
                          <>
                            {" · via "}
                            <Link href="/admin/referrers" className="underline underline-offset-2">
                              {referrerName.get(m.referrer_id) ?? "partner"}
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </td>
                    <LinkCell url={share} label="open" />
                    <LinkCell url={billing} label="open" />
                    <LinkCell url={report} label="open" />
                    <td className="px-5 py-2.5 whitespace-nowrap">
                      <a
                        href={install}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] font-medium text-[var(--color-accent)] hover:underline underline-offset-2"
                      >
                        open
                      </a>{" "}
                      <CopyButton text={install} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)] text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
          Partner links
        </div>
        {referrers.length === 0 ? (
          <div className="px-5 py-6 text-[12.5px] text-[var(--color-fg-dim)]">
            No partners yet —{" "}
            <Link href="/admin/referrers" className="underline underline-offset-2">
              create one
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border-soft)]/60">
            {referrers.map((r) => {
              const url = r.view_token ? `${origin}/partner/${r.view_token}` : null;
              return (
                <li key={r.id} className="px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[12.5px] font-medium tracking-tight">{r.name}</span>
                  {url ? (
                    <span className="inline-flex items-center gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] font-mono text-[var(--color-accent)] hover:underline underline-offset-2 break-all"
                      >
                        {url}
                      </a>
                      <CopyButton text={url} />
                    </span>
                  ) : (
                    <Link
                      href="/admin/referrers"
                      className="text-[11px] font-mono text-[var(--color-fg-muted)] underline underline-offset-2"
                    >
                      mint on Referrals →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)] text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
          Public case studies
        </div>
        <ul className="divide-y divide-[var(--color-border-soft)]/60">
          {CASE_STUDIES.map((cs) => {
            const url = `${origin}/case-studies/${cs.slug}`;
            return (
              <li key={cs.slug} className="px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[12.5px]">
                  <span className="font-medium tracking-tight">{cs.category}</span>{" "}
                  <span className="text-[var(--color-fg-muted)] font-mono text-[10.5px]">
                    {cs.brand}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11.5px] font-mono text-[var(--color-accent)] hover:underline underline-offset-2 break-all"
                  >
                    {url}
                  </a>
                  <CopyButton text={url} />
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function LinkCell({ url, label }: { url: string | null; label: string }) {
  if (!url) {
    return (
      <td className="px-3 py-2.5 whitespace-nowrap text-[11px] font-mono text-[var(--color-fg-muted)]">
        —
      </td>
    );
  }
  return (
    <td className="px-3 py-2.5 whitespace-nowrap">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11.5px] font-medium text-[var(--color-accent)] hover:underline underline-offset-2"
      >
        {label}
      </a>{" "}
      <CopyButton text={url} />
    </td>
  );
}
