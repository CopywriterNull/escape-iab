import { headers } from "next/headers";
import { getCurrentMerchant } from "@/lib/db";
import { buildShopifyPixel } from "@/lib/pixel";

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
  const pixelJs = buildShopifyPixel({
    merchantId: merchant.id,
    ingestUrl: `${origin}/api/track/funnel`,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Install</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-dim)]">
          Two steps: drop the snippet on your storefront, then drop the pixel in Shopify Customer Events.
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

      <Section
        n="1"
        title="Storefront snippet"
        sub="Drop in the top of <head> on every page. This sets the bucket cookie, escapes IG sessions to Safari, and beacons impressions."
      >
        <CodeBlock title="HTML / any storefront" lang="html" code={html} />
        <CodeBlock title="Shopify (theme.liquid)" lang="liquid" code={liquid} />
      </Section>

      <Section
        n="2"
        title="Shopify Customer Events pixel"
        sub="Required to attribute purchases back to the bucket. Without this, the dashboard only shows escape rates — no CVR or revenue lift."
      >
        <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--color-fg-dim)] mb-3">
          <li>Shopify admin → <strong>Settings</strong> → <strong>Customer events</strong>.</li>
          <li>Click <strong>Add custom pixel</strong>. Name it <code className="font-mono">EscapeHatch</code>.</li>
          <li>Set <strong>Permission</strong> to <em>Not required</em> so it fires for all visitors.</li>
          <li>Paste the code below into the pixel code area.</li>
          <li><strong>Save</strong>, then <strong>Connect</strong>.</li>
        </ol>
        <CodeBlock title="Custom pixel code" lang="javascript" code={pixelJs} />
      </Section>

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
          <li>Tap it on your phone (inside Instagram). You should bounce out to Safari within ~1s.</li>
          <li>Complete a test order on the same device. Use a real cart so checkout_completed fires.</li>
          <li>Refresh this page — impression and purchase events should appear in Overview within 30s.</li>
          <li>If purchases don&apos;t show up, check Shopify admin → Customer Events → EscapeHatch → status is <em>Connected</em>.</li>
        </ol>
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
    <div className="card p-6 space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm text-[var(--color-accent)]">{n}.</span>
        <div className="flex-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-fg-dim)]">{sub}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
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
