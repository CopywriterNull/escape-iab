import { headers } from "next/headers";
import { getCurrentMerchant } from "@/lib/db";

export default async function InstallPage() {
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    return <div className="card p-8">No merchant yet — refresh in a moment.</div>;
  }

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;
  const snippetUrl = `${origin}/s/${merchant.id}.js`;

  const html = `<script src="${snippetUrl}" async></script>`;
  const liquid = `{% comment %} EscapeHatch — IG IAB redirect {% endcomment %}\n${html}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Install</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-dim)]">
          Paste the snippet into your storefront. Top of <code className="font-mono">&lt;head&gt;</code> is best.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">Your merchant ID</h2>
        <div className="mt-2 flex items-center gap-2">
          <code className="font-mono text-sm bg-[var(--color-bg-elev)] border border-[var(--color-border)] rounded px-3 py-2 flex-1 break-all">
            {merchant.id}
          </code>
        </div>
        <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
          This ID is public — it&apos;s baked into the snippet URL. Don&apos;t share it as if it were a secret.
        </p>
      </div>

      <CodeBlock title="HTML / any storefront" lang="html" code={html} />
      <CodeBlock title="Shopify (theme.liquid)" lang="liquid" code={liquid} />

      <div className="card p-6 text-sm">
        <h2 className="font-semibold">Why top of <code className="font-mono">&lt;head&gt;</code>?</h2>
        <p className="mt-2 text-[var(--color-fg-dim)]">
          The script needs to run before the page paints in IG&apos;s in-app browser.
          If you put it at the bottom of <code className="font-mono">&lt;body&gt;</code>, the user briefly
          sees the broken IAB before redirecting.
        </p>
      </div>

      <div className="card p-6 text-sm">
        <h2 className="font-semibold">Verify it&apos;s working</h2>
        <ol className="mt-3 list-decimal list-inside space-y-1 text-[var(--color-fg-dim)]">
          <li>DM yourself a link to your storefront on Instagram.</li>
          <li>Tap it on your phone (inside Instagram).</li>
          <li>You should bounce out to Safari (iOS) or your default browser (Android) within ~1s.</li>
          <li>Refresh this page — an &quot;impression&quot; event should appear in Overview.</li>
        </ol>
      </div>
    </div>
  );
}

function CodeBlock({ title, lang, code }: { title: string; lang: string; code: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[#0a0a14] overflow-hidden elevated">
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
