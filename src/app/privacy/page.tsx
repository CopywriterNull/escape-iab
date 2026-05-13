import Link from "next/link";
import { brand } from "@/lib/branding";

export const metadata = {
  title: "Privacy policy",
  description: `Privacy policy for ${brand.name}.`,
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain relative">
      <div className="mx-auto max-w-2xl px-5 py-16 md:py-24">
        <Link href="/" className="text-[12px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          ← {brand.domain}
        </Link>
        <h1 className="mt-6 h-display text-[36px] md:text-[44px] tracking-tight">Privacy policy</h1>
        <p className="mt-3 text-[12px] font-mono text-[var(--color-fg-muted)]">Last updated · {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-10 prose prose-sm max-w-none text-[var(--color-fg-dim)] leading-relaxed space-y-6 text-[14.5px]">
          <Section title="What we collect">
            <p>
              When a paid Instagram visitor lands on your store with the {brand.name} snippet installed, we record a single event row per escape attempt. That row contains: an IP-hashed visitor ID, the user-agent string, UTM parameters from the URL, the storefront cookie identifier (<code>_shopify_y</code>), and the bucket assignment for the A/B test. We do not collect names, emails, phone numbers, payment data, or any first-party PII.
            </p>
          </Section>
          <Section title="What we don't do">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>We do not set tracking cookies on your customers&apos; browsers.</li>
              <li>We do not fingerprint visitors across stores or devices.</li>
              <li>We do not sell, license, or share any visitor data with third parties.</li>
              <li>We do not run analytics SDKs (no Google, Meta, or Mixpanel embed).</li>
            </ul>
          </Section>
          <Section title="How merchants use the data">
            <p>
              You get an authenticated dashboard scoped to your own merchant ID. Only you and the {brand.name} operations team (under NDA) can see your event stream. We retain raw event rows for 13 months; aggregated daily rollups for 36 months.
            </p>
          </Section>
          <Section title="GDPR / CCPA">
            <p>
              The visitor data is non-personal under both regulations (IP-hashed, no identifier returned to client). You may classify {brand.name} as a &quot;functional&quot; tool in your consent banner. If you need a signed Data Processing Agreement (DPA), email <a href="mailto:hi@getescapehatch.com" className="text-[var(--color-accent)]">hi@getescapehatch.com</a> and we&apos;ll send one over.
            </p>
          </Section>
          <Section title="Right to delete">
            <p>
              Customers can request deletion of any record we hold by emailing us with their <code>_shopify_y</code> cookie value or the timestamp of their visit. We&apos;ll honor it within 30 days.
            </p>
          </Section>
          <Section title="Contact">
            <p>
              Privacy questions: <a href="mailto:hi@getescapehatch.com" className="text-[var(--color-accent)]">hi@getescapehatch.com</a>. Postal mail on request.
            </p>
          </Section>

          <p className="text-[12px] font-mono text-[var(--color-fg-muted)] pt-6 border-t border-[var(--color-border-soft)]">
            This page is a working stub. Final policy will be reviewed by counsel before {brand.name} exits private beta.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="h-section text-[18px] text-[var(--color-fg)] mb-2">{title}</h2>
      {children}
    </section>
  );
}
