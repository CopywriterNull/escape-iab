import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMerchant, getCurrentRole, getImpersonationStatus } from "@/lib/db";
import { buildShopifyPixel } from "@/lib/pixel";
import { parseAllowedDomains } from "@/lib/snippet";
import { roleAtLeast } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function InstallPage() {
  const [merchant, impersonation] = await Promise.all([
    getCurrentMerchant(),
    getImpersonationStatus(),
  ]);
  if (!merchant) {
    return <div className="card p-8">No merchant yet — refresh in a moment.</div>;
  }

  // Spec §4: install page is owner+member; viewers land back on overview.
  const role = await getCurrentRole(merchant);
  if (!roleAtLeast(role, "member")) redirect("/dashboard");

  const impersonationMismatch =
    impersonation.active && impersonation.merchant?.id
      ? impersonation.merchant.id !== merchant.id
      : false;

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;
  // Bump the ?v= when you ship a config change so Vercel's 5-min edge cache
  // on /s/[id].js doesn't keep serving the old baked-in flags.
  const snippetUrl = `${origin}/s/${merchant.id}.js?v=14`;

  // CRITICAL: no `async`, no `defer`. The IG IAB redirect must fire before
  // Instagram's webview commits to rendering — once it paints, the
  // extbrowser scheme is silently dropped. We've been bitten by this on
  // multiple merchant installs. The install tag is intentionally sync.
  const html = `<script src="${snippetUrl}"></script>`;
  const liquid = `{% comment %} EscapeHatch — IG IAB redirect (must be SYNC — no async/defer) {% endcomment %}\n${html}`;
  const pixelJs = buildShopifyPixel({
    merchantId: merchant.id,
    ingestUrl: `${origin}/api/track/funnel`,
  });

  // Hostname binding state — same parser the snippet route uses, so what
  // we show here is exactly what'll get baked into /s/{id}.js.
  const allowedDomains = parseAllowedDomains(merchant.domain);
  const hostnameBound = allowedDomains.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          Setup · two steps
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="h-display text-4xl">Install</h1>
          <a
            href={`/install/${merchant.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline underline-offset-2"
          >
            Public install guide →
          </a>
        </div>
        <p className="mt-2 text-sm text-[var(--color-fg-dim)] max-w-prose leading-relaxed">
          Drop the snippet on your storefront, drop the pixel in Shopify Customer Events. Total time: under 5 minutes.
        </p>
      </div>

      <div className={`rounded-lg border px-4 py-2.5 text-[12px] font-mono flex items-center justify-between gap-3 ${
        impersonationMismatch
          ? "border-[var(--color-danger)]/45 bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)]"
          : impersonation.active
            ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 text-[var(--color-fg)]"
            : "border-[var(--color-border-soft)] bg-[var(--color-card)] text-[var(--color-fg-dim)]"
      }`}>
        <span className="min-w-0 truncate">
          {impersonationMismatch ? "Merchant mismatch:" : impersonation.active ? "Installing as admin:" : "Installing for:"}{" "}
          <strong className="text-[var(--color-fg)]">{merchant.name ?? "(unnamed)"}</strong>
          <span className="text-[var(--color-fg-muted)]"> · {merchant.domain ?? "—"}</span>
        </span>
        <span className="shrink-0 text-[10px] text-[var(--color-fg-muted)]" title={merchant.id}>
          {merchant.id}
        </span>
      </div>

      {hostnameBound ? (
        <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/8 px-4 py-3 text-[12px]">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-[var(--color-success)]">
            <span className="inline-block size-1.5 rounded-full bg-[var(--color-success)]" />
            Snippet locked to {allowedDomains.join(", ")}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[var(--color-fg-muted)]">
            Only fires on these hostnames + any subdomain. Copies pasted on other sites will bail before escape.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-4 py-3 text-[12px] text-[var(--color-warn)]">
          <div className="font-semibold tracking-tight">
            Hostname binding not configured
          </div>
          <div className="mt-1 text-[11.5px] font-mono leading-relaxed text-[var(--color-fg-muted)]">
            Your snippet currently fires on any hostname. Anyone who copies it from your storefront can reuse it on their own site.
            {" "}
            <Link href="/dashboard/settings" className="underline decoration-dotted underline-offset-2 text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]">
              Set your storefront domain in Settings
            </Link>
            {" "}to lock the snippet — supports `andar.com`, `https://andar.com`, or `andar.com, uk.andar.com` for multi-domain.
          </div>
        </div>
      )}

      <div className="card-hi p-6 flex items-center gap-4">
        <div className="size-10 rounded-xl bg-[var(--color-accent)]/15 grid place-items-center shrink-0">
          <svg viewBox="0 0 24 24" className="size-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="4" y="6" width="16" height="12" rx="2" />
            <path d="M4 10h16" />
            <circle cx="8" cy="14" r="0.5" fill="currentColor" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] font-medium">Your merchant ID</div>
          <code className="mt-1 block font-mono text-sm text-[var(--color-fg)] break-all tnum">
            {merchant.id}
          </code>
        </div>
        <span className="hidden sm:inline-block text-[11px] text-[var(--color-fg-muted)] max-w-[180px] text-right leading-tight">
          Public — baked into the snippet URL.
        </span>
      </div>

      <Section
        n="01"
        title="Storefront snippet"
        sub="Drop in the top of <head> on every page. Detects IG/Threads visitors and reopens them in Safari/Chrome before checkout breaks."
      >
        <CodeBlock title="theme.liquid · top of <head>" lang="liquid" code={liquid} />
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/30 px-4 py-3 text-[12.5px] leading-relaxed">
          <strong className="text-[var(--color-danger)]">No <code className="font-mono">async</code>, no <code className="font-mono">defer</code>.</strong>{" "}
          <span className="text-[var(--color-fg-dim)]">
            The redirect must fire <em>before</em> Instagram&apos;s webview commits to rendering. With <code className="font-mono">async</code> the browser paints first and IG silently drops the <code className="font-mono">extbrowser</code> scheme — snippet looks installed, nothing escapes. Some Shopify apps (Edgemesh, theme optimizers) auto-add <code className="font-mono">async</code> to scripts in <code className="font-mono">&lt;head&gt;</code>; if yours does, disable that for this tag.
          </span>
        </div>
        <details className="text-sm text-[var(--color-fg-dim)]">
          <summary className="cursor-pointer link-grow inline-block">For non-Shopify storefronts</summary>
          <div className="mt-3"><CodeBlock title="any storefront · &lt;head&gt;" lang="html" code={html} /></div>
        </details>
      </Section>

      <Section
        n="02"
        title="Shopify Customer Events pixel"
        sub="Required to attribute purchases back to the bucket. Without this, the dashboard shows escape rates but no CVR or revenue lift."
      >
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-[var(--color-fg-dim)] mb-2">
          <li>Shopify admin → <strong className="text-[var(--color-fg)]">Settings → Customer events</strong></li>
          <li>Click <strong className="text-[var(--color-fg)]">Add custom pixel</strong>, name it <code className="font-mono text-[12px] bg-[var(--color-bg-elev)] px-1.5 py-0.5 rounded">EscapeHatch</code></li>
          <li>Permission: <strong className="text-[var(--color-fg)]">Not required</strong> (so it fires for all visitors)</li>
          <li>Paste the code below into the pixel code area</li>
          <li><strong className="text-[var(--color-fg)]">Save → Connect</strong></li>
        </ol>
        <CodeBlock title="Custom pixel code" lang="javascript" code={pixelJs} />
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-lg bg-[var(--color-accent)]/10 grid place-items-center text-[var(--color-accent)]">
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 1v4M8 11v4M1 8h4M11 8h4" strokeLinecap="round" />
                <circle cx="8" cy="8" r="2" />
              </svg>
            </span>
            <h3 className="font-semibold tracking-tight">Why top of <code className="font-mono text-[13px]">&lt;head&gt;</code>?</h3>
          </div>
          <p className="mt-3 text-sm text-[var(--color-fg-dim)] leading-relaxed">
            The script needs to run before the page paints in IG&apos;s in-app browser. Anywhere lower and the user briefly sees the broken IAB before the redirect fires.
          </p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-lg bg-[var(--color-success)]/10 grid place-items-center text-[var(--color-success)]">
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h3 className="font-semibold tracking-tight">Verify it&apos;s working</h3>
          </div>
          <ol className="mt-3 list-decimal pl-5 space-y-1.5 text-sm text-[var(--color-fg-dim)]">
            <li>DM yourself a storefront link on Instagram.</li>
            <li>Tap it inside the IG app — should bounce to Safari within ~1s.</li>
            <li>Complete a test order. Land on thank-you page.</li>
            <li>Reload Overview — impression and purchase events should appear within 30s.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  sub,
  children,
}: {
  n: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-hi p-7 space-y-5">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[12px] tracking-wider text-[var(--color-accent)]">{n}</span>
        <div className="flex-1">
          <h2 className="h-section text-xl">{title}</h2>
          <p className="mt-1.5 text-sm text-[var(--color-fg-dim)] leading-relaxed">{sub}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function CodeBlock({ title, lang, code }: { title: string; lang: string; code: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[#0a0a14] overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2 text-[11px] text-white/60">
          <span className="size-2 rounded-full bg-[#ff5f57]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
          <span className="ml-2 font-mono">{title}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">{lang}</span>
      </div>
      <pre className="px-5 py-4 text-[13px] leading-relaxed font-mono text-white/95 overflow-x-auto whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
