import Link from "next/link";
import { brand } from "@/lib/branding";

export const metadata = {
  title: "Terms of service",
  description: `Terms of service for ${brand.name}.`,
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain relative">
      <div className="mx-auto max-w-2xl px-5 py-16 md:py-24">
        <Link href="/" className="text-[12px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          ← {brand.domain}
        </Link>
        <h1 className="mt-6 h-display text-[36px] md:text-[44px] tracking-tight">Terms of service</h1>
        <p className="mt-3 text-[12px] font-mono text-[var(--color-fg-muted)]">Last updated · {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-10 max-w-none text-[var(--color-fg-dim)] leading-relaxed space-y-6 text-[14.5px]">
          <Section title="The deal">
            <p>
              You install the {brand.name} snippet on your Shopify store. We detect Instagram&apos;s in-app browser, reopen your store in Safari before checkout loads, and run an A/B test so you can prove the lift on your own traffic. In exchange, you pay your monthly plan (or nothing if you&apos;re on the free tier).
            </p>
          </Section>
          <Section title="Acceptable use">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>One Shopify domain per merchant account on Free; unlimited on Scale.</li>
              <li>Don&apos;t use {brand.name} to redirect traffic away from a store you don&apos;t own.</li>
              <li>Don&apos;t use {brand.name} for malware, phishing, gambling, regulated substances without proper licenses, or any content that violates Meta&apos;s commerce policies.</li>
              <li>Don&apos;t reverse-engineer the snippet to circumvent our pricing tiers.</li>
            </ul>
          </Section>
          <Section title="Uptime">
            <p>
              The snippet is edge-cached and runs entirely client-side, so an outage on our origin doesn&apos;t break your store. Best-effort target for the dashboard and event ingest is 99.9% monthly. Scale customers get an SLA in writing.
            </p>
          </Section>
          <Section title="Refunds">
            <p>
              Cancel anytime; we don&apos;t prorate. If our service is materially broken for more than 7 consecutive days in a billing month, email us and we&apos;ll refund that month in full.
            </p>
          </Section>
          <Section title="Liability">
            <p>
              {brand.name} is provided &quot;as is.&quot; Our maximum liability for any claim is the amount you paid us in the prior 12 months. We&apos;re not responsible for downstream consequences (a Meta ban, a Shopify policy violation, etc.) — you remain responsible for your own store&apos;s compliance.
            </p>
          </Section>
          <Section title="Changes">
            <p>
              We&apos;ll email customers at least 14 days before any material change to these terms. If you don&apos;t like the change, cancel — we&apos;ll prorate-refund the unused portion.
            </p>
          </Section>
          <Section title="Contact">
            <p>
              Terms questions: <a href="mailto:hi@getescapehatch.com" className="text-[var(--color-accent)]">hi@getescapehatch.com</a>.
            </p>
          </Section>

          <p className="text-[12px] font-mono text-[var(--color-fg-muted)] pt-6 border-t border-[var(--color-border-soft)]">
            This page is a working stub. Final terms will be reviewed by counsel before {brand.name} exits private beta.
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
