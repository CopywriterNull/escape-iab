import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildShopifyPixel } from "@/lib/pixel";
import { CopyableCode } from "@/components/CopyableCode";
import { brand } from "@/lib/branding";

export const dynamic = "force-dynamic";

type MerchantRow = {
  id: string;
  name: string | null;
  domain: string | null;
  shopify_domain: string | null;
};

export default async function InstallGuide({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  const { merchantId } = await params;
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(merchantId)) notFound();

  const admin = getSupabaseAdmin();
  if (!admin) notFound();
  const { data } = await admin
    .from("merchants")
    .select("id, name, domain, shopify_domain")
    .eq("id", merchantId)
    .maybeSingle();
  if (!data) notFound();
  const merchant = data as MerchantRow;

  const snippet = `<script src="https://escape-iab.vercel.app/s/${merchant.id}.js?v=9"></script>`;
  const pixel = buildShopifyPixel({
    merchantId: merchant.id,
    ingestUrl: "https://escape-iab.vercel.app/api/track/funnel",
  });
  const webhookUrl = "https://escape-iab.vercel.app/api/webhooks/shopify/orders";

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-8 border-b border-[var(--color-border-soft)]">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6" />
                <path d="M20 4l-8 8" />
                <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
              </svg>
            </span>
            <span>{brand.name}</span>
          </Link>
          <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">Install guide</span>
        </div>

        {/* Greeting */}
        <div className="mt-10">
          <div className="eyebrow">Setup · ~60 seconds</div>
          <h1 className="mt-3 h-display text-[36px] md:text-[44px] tracking-tight">
            Install {brand.name} on{" "}
            <span className="h-editorial text-[var(--color-accent)]">
              {merchant.name ?? "your store"}
            </span>
          </h1>
          <p className="mt-4 text-[14.5px] text-[var(--color-fg-dim)] max-w-xl leading-relaxed">
            Three blocks to paste, in this order. Each one is scoped to your store — no
            edits needed. When you're done, message us back and we&apos;ll verify it&apos;s
            firing live.
          </p>
        </div>

        {/* Step 1 — Snippet */}
        <Section number="01" title="Paste the snippet in your theme">
          <p className="text-[13.5px] text-[var(--color-fg-dim)] leading-relaxed">
            In your Shopify admin → <strong>Online Store → Themes</strong> → on your live
            theme click <strong>···</strong> → <strong>Edit code</strong>. Open{" "}
            <code className="text-[12px] font-mono px-1 py-0.5 rounded bg-[var(--color-bg-elev)]">
              layout/theme.liquid
            </code>{" "}
            and paste this <strong>inside the <code>&lt;head&gt;</code> tag</strong>, as
            high up as possible. Save.
          </p>
          <div className="mt-4">
            <CopyableCode code={snippet} label="snippet" />
          </div>
          <p className="mt-3 text-[12px] text-[var(--color-fg-muted)] italic">
            Don&apos;t use the <code>async</code> attribute — the snippet needs to run
            synchronously before paint to catch the IG visitor in time.
          </p>
        </Section>

        {/* Step 2 — Customer Events pixel */}
        <Section number="02" title="Add the Customer Events pixel">
          <p className="text-[13.5px] text-[var(--color-fg-dim)] leading-relaxed">
            In your Shopify admin → <strong>Settings → Customer events</strong> →{" "}
            <strong>Add custom pixel</strong>. Name it{" "}
            <code className="text-[12px] font-mono px-1 py-0.5 rounded bg-[var(--color-bg-elev)]">
              EscapeHatch
            </code>
            , set <strong>Permission</strong> to <strong>Not required</strong>, then paste
            this into the Code box. Save → <strong>Connect</strong>.
          </p>
          <div className="mt-4">
            <CopyableCode code={pixel} label="pixel" />
          </div>
        </Section>

        {/* Step 3 — Webhook */}
        <Section number="03" title="Add the Order paid webhook">
          <p className="text-[13.5px] text-[var(--color-fg-dim)] leading-relaxed">
            In your Shopify admin → <strong>Settings → Notifications → Webhooks</strong> →{" "}
            <strong>Create webhook</strong>. Use these values:
          </p>
          <div className="mt-4 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg-elev)] divide-y divide-[var(--color-border-soft)] text-[12.5px]">
            <Row label="Event" value="Order paid" />
            <Row label="Format" value="JSON" />
            <Row label="URL" value={webhookUrl} mono copyable />
            <Row label="API version" value="latest stable" />
          </div>
          <p className="mt-3 text-[12px] text-[var(--color-fg-muted)] italic">
            This is what gives us authoritative purchase data — survives Shop Pay,
            Apple Pay, returning customers, every checkout flow Shopify supports.
          </p>
        </Section>

        {/* Done */}
        <Section number="04" title="You're done — message us">
          <p className="text-[13.5px] text-[var(--color-fg-dim)] leading-relaxed">
            Ping us when those three are saved. We&apos;ll confirm we&apos;re seeing
            events flow in within minutes and turn on your A/B test. First lift readout
            usually comes 5-14 days in, depending on traffic.
          </p>
          <a
            href="mailto:hi@escapehatch.app"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[13px] font-medium press lift focus-ring"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            hi@escapehatch.app
          </a>
        </Section>

        {/* Footer meta */}
        <div className="mt-16 pt-6 border-t border-[var(--color-border-soft)] flex items-center justify-between text-[11px] font-mono text-[var(--color-fg-muted)]">
          <span>Merchant ID · {merchant.id}</span>
          {merchant.shopify_domain ? (
            <span>{merchant.shopify_domain}</span>
          ) : (
            <span>shopify domain not yet set</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 pt-10 border-t border-[var(--color-border-soft)] first:border-t-0 first:pt-0 first:mt-12">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-[11px] font-mono tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          {number}
        </span>
        <h2 className="h-section text-[20px] tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-[10.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
        {label}
      </span>
      <span className={`text-right text-[var(--color-fg)] ${mono ? "font-mono text-[12px]" : ""} truncate`}>
        {copyable ? <CopyableInline value={value} /> : value}
      </span>
    </div>
  );
}

function CopyableInline({ value }: { value: string }) {
  return <span className="select-all">{value}</span>;
}
