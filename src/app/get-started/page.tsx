import Link from "next/link";
import { brand } from "@/lib/branding";
import { EarlyAccessForm } from "@/components/EarlyAccessForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;

  return (
    <div className="min-h-dvh grid place-items-center px-5 py-16 mesh-bg grain relative">
      <div className="absolute inset-0 dotgrid opacity-30 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      <div className="relative w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2.5 font-semibold tracking-tight focus-ring rounded-md">
          <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-lg" style={{ background: "var(--color-accent)" }}>
            <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14a8 8 0 1 0 8-8" />
              <path d="M14 4h6v6" />
              <path d="M20 4l-8 8" />
            </svg>
          </span>
          {brand.name}
        </Link>
        <div className="mt-7 text-center">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
            Early access
          </div>
          <h1 className="mt-1 h-display text-3xl sm:text-4xl">Tell us about your brand</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-dim)] max-w-md mx-auto">
            A few details so we can get you set up. We&apos;ll reach out within one business day.
          </p>
        </div>

        <EarlyAccessForm initialEmail={email} />

        <p className="mt-7 text-center text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
          By submitting you agree to the{" "}
          <Link href="/terms" className="underline-offset-2 hover:text-[var(--color-fg-dim)] underline">terms</Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline-offset-2 hover:text-[var(--color-fg-dim)] underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}
