import Link from "next/link";
import { brand } from "@/lib/branding";

// Lightweight marketing chrome for the case-study pages. The full Lander nav
// is anchor-driven (#how, #pricing) and carries live proof props, so these
// pages get a slim header that routes back to the homepage sections instead.

export function CaseStudyHeader() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--color-bg)]/80 border-b border-[var(--color-border)]/60">
      <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight focus-ring rounded-md text-[15px]"
        >
          <span className="inline-block size-2 rounded-full bg-[var(--color-accent)]" />
          {brand.name}
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/case-studies"
            className="hidden sm:inline-block text-sm text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] px-3 py-1.5 transition-colors focus-ring rounded-md"
          >
            Case studies
          </Link>
          <Link
            href="/#pricing"
            className="hidden sm:inline-block text-sm text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] px-3 py-1.5 transition-colors focus-ring rounded-md"
          >
            Pricing
          </Link>
          <Link
            href="/#waitlist"
            className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            Get early access
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function CaseStudyFooter() {
  return (
    <footer className="border-t border-[var(--color-border-soft)] mt-16">
      <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11.5px] font-mono text-[var(--color-fg-muted)]">
        <span>
          © {new Date().getFullYear()} {brand.name} · Every number on this page is first-party,
          randomized, and reproducible on your own traffic.
        </span>
        <Link href="/" className="hover:text-[var(--color-fg)] transition-colors">
          {brand.domain}
        </Link>
      </div>
    </footer>
  );
}
