export const dynamic = "force-dynamic";

export default function AdminGuides() {
  return (
    <div className="space-y-7">
      <div>
        <div className="eyebrow">Admin · Guides</div>
        <h1 className="mt-2 h-display text-[28px] tracking-tight">Operator guides</h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-dim)] max-w-xl">
          Short playbooks for installing, configuring, and debugging EscapeHatch. Real lessons from real incidents.
        </p>
      </div>

      <div className="space-y-3">
        <Guide
          tag="install"
          title="Snippet must run synchronously"
          severity="danger"
          summary="No async, no defer. First script in <head>."
        >
          <p>
            The IG IAB redirect has to fire <strong>before Instagram&apos;s webview commits to rendering the page</strong>. With <code className="font-mono">async</code> or <code className="font-mono">defer</code>, the browser parses HTML and may paint before the snippet runs — by then IG considers the navigation complete and the <code className="font-mono">extbrowser</code> scheme is silently ignored.
          </p>
          <Code>{`<!-- ✓ correct -->
<script src="https://getescapehatch.com/s/MERCHANT_ID.js?v=12"></script>

<!-- ✗ wrong — IG will ignore the redirect -->
<script src="..." async></script>
<script src="..." defer></script>`}</Code>
          <p className="text-[12px] text-[var(--color-fg-muted)]">
            Place as the <strong>first</strong> <code className="font-mono">&lt;script&gt;</code> in <code className="font-mono">theme.liquid</code> <code className="font-mono">&lt;head&gt;</code>. Anything above it (analytics, Klaviyo, etc.) will delay the redirect by however long that script takes to parse.
          </p>
        </Guide>

        <Guide
          tag="cache"
          title="Bust the edge cache after config changes"
          severity="warn"
          summary="max-age=300 — bump ?v= or wait 5 min."
        >
          <p>
            The snippet endpoint sets <code className="font-mono">cache-control: public, max-age=300, s-maxage=300</code>. Vercel&apos;s edge holds the response for 5 min, so flipping kill switch / paid-only / fallback text doesn&apos;t propagate instantly.
          </p>
          <p>
            <strong>Fix:</strong> bump the <code className="font-mono">?v=</code> query in the merchant&apos;s <code className="font-mono">&lt;script src&gt;</code>. Each unique query is a new cache key — fresh fetch on the next pageview.
          </p>
          <Code>{`<!-- before change -->
<script src="https://getescapehatch.com/s/ID.js?v=12"></script>

<!-- after flipping a setting -->
<script src="https://getescapehatch.com/s/ID.js?v=13"></script>`}</Code>
        </Guide>

        <Guide
          tag="config"
          title="Kill switch (escape_enabled)"
          summary="Pause the redirect without uninstalling the snippet."
        >
          <p>
            When <code className="font-mono">escape_enabled = false</code>, the snippet still beacons impressions (so the dashboard sees traffic) but skips the <code className="font-mono">location.replace</code> call. Useful for emergencies or to A/B against zero-escape baseline.
          </p>
          <p>
            <strong>Symptom of accidental kill switch:</strong> served JS ends with <code className="font-mono">return void w(&quot;escape_skipped&quot;,&#123;r:&quot;k&quot;&#125;)</code> and the entire redirect block is dead-code-eliminated by the minifier. <code className="font-mono">curl</code> the snippet URL and read the tail — if you see the redirect <code className="font-mono">setTimeout</code> + visibility polling, you&apos;re good.
          </p>
          <Code>{`-- flip it back on
update public.merchants
set escape_enabled = true
where id = 'MERCHANT_ID';

-- then bump ?v= on the snippet to bust the edge cache`}</Code>
        </Guide>

        <Guide
          tag="config"
          title="Paid-only mode (paid_only)"
          summary="Restrict the test population to paid Meta clicks only."
        >
          <p>
            With <code className="font-mono">paid_only = true</code>, the snippet only escapes IG IAB visitors who arrived via <code className="font-mono">fbclid</code> or <code className="font-mono">utm_source=facebook|instagram|fb|ig|meta</code> + <code className="font-mono">utm_medium=paid|cpc|ad</code>. Organic IG traffic (story links, link-in-bio, DMs) is left alone.
          </p>
          <p>
            With <code className="font-mono">paid_only = false</code>, <strong>every</strong> Meta IAB visitor gets bucketed and (in bucket A) escaped. Higher coverage but more variance — only flip off when the merchant explicitly wants organic IG traffic redirected too.
          </p>
          <p className="text-[12px] text-[var(--color-fg-muted)]">
            Debug tip: in Vercel runtime logs, look for <code className="font-mono">t:&quot;impression&quot;, it:1</code> (in test) vs <code className="font-mono">it:0</code> (not in test) to confirm gating.
          </p>
        </Guide>

        <Guide
          tag="webhook"
          title="Multi-tenant Shopify order webhook"
          summary="One URL, many merchants — routed by X-Shopify-Shop-Domain."
        >
          <p>
            Every merchant points their Shopify Order Paid webhook at the same URL: <code className="font-mono">https://getescapehatch.com/api/webhooks/shopify/orders</code>. The handler reads <code className="font-mono">X-Shopify-Shop-Domain</code> and looks up the merchant by <code className="font-mono">shopify_domain</code>.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-[12.5px]">
            <li>In each merchant&apos;s row on <a className="underline-offset-2 underline hover:text-[var(--color-fg)]" href="/admin/merchants">/admin/merchants</a>, set <strong>Shopify admin domain</strong> to <code className="font-mono">theirshop.myshopify.com</code> (NOT their public domain).</li>
            <li>In their Shopify admin: Settings → Notifications → Webhooks → Create. Event: <em>Order paid</em>. Format: JSON. URL: <code className="font-mono">https://getescapehatch.com/api/webhooks/shopify/orders</code>.</li>
            <li>Copy the webhook secret. It must match <code className="font-mono">SHOPIFY_WEBHOOK_SECRET</code> in Vercel env (currently shared across merchants — per-merchant secrets is a follow-up).</li>
          </ol>
          <p className="text-[12px] text-[var(--color-fg-muted)]">
            If the handler returns 404 <code className="font-mono">unknown_shop_domain</code>, the Shopify admin domain field is wrong or missing.
          </p>
        </Guide>

        <Guide
          tag="pixel"
          title="Shopify Custom Pixel for funnel tracking"
          summary="checkout_started, product_viewed, add_to_cart join back to impressions."
        >
          <p>
            Order Paid webhook handles purchases. Mid-funnel events (product view, add-to-cart, checkout start) need a Custom Pixel installed in <em>Settings → Customer events → Add custom pixel</em>. Paste the merchant&apos;s pixel snippet (printed on the install guide page) and set permission to <strong>Not required</strong>.
          </p>
          <p>
            Pixel events POST to <code className="font-mono">/api/track/funnel</code> with the visitor&apos;s <code className="font-mono">eh_sid</code> from the cart attribute. The server joins to the original impression by <code className="font-mono">cart_token</code> first, then <code className="font-mono">eh_sid</code>, then <code className="font-mono">fbclid</code>.
          </p>
          <p className="text-[12px] text-[var(--color-fg-muted)]">
            Pixel runs in a Shopify sandbox — no DOM access, no <code className="font-mono">window</code>. Don&apos;t add custom JS that touches the page.
          </p>
        </Guide>

        <Guide
          tag="qa"
          title="QA checklist before handing off install"
          summary="curl the snippet, check tail for redirect path, log a test impression."
        >
          <ol className="list-decimal pl-5 space-y-1 text-[12.5px]">
            <li>
              <strong>Serve check:</strong>
              <Code>{`curl -sI "https://getescapehatch.com/s/MERCHANT_ID.js?v=999"
# expect: 200 + content-type: application/javascript + x-eh-version: v9`}</Code>
            </li>
            <li>
              <strong>Redirect path present (kill switch off):</strong>
              <Code>{`curl -s "https://getescapehatch.com/s/MERCHANT_ID.js?v=999" | tail -c 400
# expect: ...setTimeout(...location.replace(s)...)... + fallback button code
# bad:    ...return void w("escape_skipped",{r:"k"})  ← kill switch on`}</Code>
            </li>
            <li>
              <strong>Live impression:</strong> from your phone, open the merchant&apos;s site inside Instagram (story link or @-mention). Then check the dashboard &quot;Live activity&quot; — you should see <code className="font-mono">impression</code> within seconds.
            </li>
            <li>
              <strong>Webhook:</strong> place a $0.01 test order on the merchant&apos;s store. Vercel runtime logs should show <code className="font-mono">[shopify-webhook]</code> with <code className="font-mono">orderId</code> + <code className="font-mono">cart_token</code>.
            </li>
          </ol>
        </Guide>
      </div>
    </div>
  );
}

function Guide({
  tag,
  title,
  summary,
  severity,
  children,
}: {
  tag: string;
  title: string;
  summary: string;
  severity?: "danger" | "warn";
  children: React.ReactNode;
}) {
  const accent =
    severity === "danger"
      ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/30"
      : severity === "warn"
        ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
        : "border-[var(--color-border-soft)] bg-[var(--color-card)]";
  return (
    <details className={`rounded-xl border ${accent} overflow-hidden`}>
      <summary className="cursor-pointer list-none px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[var(--color-bg-elev)]/30">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)] px-1.5 py-0.5 rounded bg-[var(--color-bg-elev)]/60 border border-[var(--color-border-soft)]">
              {tag}
            </span>
            <span className="text-[14px] font-medium tracking-tight">{title}</span>
          </div>
          <div className="mt-1 text-[12px] text-[var(--color-fg-dim)] truncate">{summary}</div>
        </div>
        <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">expand ▾</span>
      </summary>
      <div className="border-t border-[var(--color-border-soft)] px-5 py-4 space-y-3 text-[13px] text-[var(--color-fg-dim)] leading-relaxed">
        {children}
      </div>
    </details>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="text-[11.5px] font-mono bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap text-[var(--color-fg)]">
      {children}
    </pre>
  );
}
