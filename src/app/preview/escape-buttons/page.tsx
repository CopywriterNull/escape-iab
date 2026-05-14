import Link from "next/link";
import { brand } from "@/lib/branding";

export const metadata = {
  title: "Escape button variants",
};

type Variant = {
  key: string;
  name: string;
  desc: string;
  render: () => React.ReactNode;
};

export default function EscapeButtonsPreview() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <div className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        {/* Header */}
        <div className="flex items-baseline justify-between gap-3 pb-6 border-b border-[var(--color-border-soft)]">
          <div>
            <div className="eyebrow">Preview · button variants</div>
            <h1 className="mt-2 h-display text-[28px] tracking-tight">
              Six escape-button designs ·{" "}
              <span className="h-editorial text-[var(--color-accent)]">pick one</span>
            </h1>
            <p className="mt-2 text-[13.5px] text-[var(--color-fg-dim)] max-w-xl">
              All rendered inside the same IG webview frame. Same job — pull the
              visitor out of the in-app browser. Different visual weight, different
              implications for how aggressive the prompt feels.
            </p>
          </div>
          <Link
            href="/preview/ig-experience"
            className="text-[12px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hidden sm:inline"
          >
            ← single preview
          </Link>
        </div>

        {/* Grid of variant frames */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {VARIANTS.map((v) => (
            <VariantCard key={v.key} v={v} />
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--color-border-soft)] text-[11.5px] font-mono text-[var(--color-fg-muted)]">
          Each variant is purely visual. Production currently ships variant{" "}
          <strong className="text-[var(--color-fg)]">A · floating pill</strong>. To swap,
          adjust the inline style block in the self-escape script (and the merchant
          snippet for client deployments).
        </div>
      </div>
    </div>
  );
}

function VariantCard({ v }: { v: Variant }) {
  return (
    <div className="space-y-3">
      <PhoneShell>{v.render()}</PhoneShell>
      <div className="px-1">
        <div className="text-[13px] font-medium tracking-tight">{v.name}</div>
        <div className="mt-1 text-[12px] text-[var(--color-fg-dim)] leading-snug">{v.desc}</div>
      </div>
    </div>
  );
}

/* ─── Phone shell — simplified frame with IG chrome ─── */

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-[32px] p-2 mx-auto w-full max-w-[280px]"
      style={{
        background: "linear-gradient(180deg, #1a1a1d 0%, #0d0d0f 100%)",
        boxShadow:
          "0 20px 40px -10px rgba(15,23,42,0.35), 0 1px 0 rgba(255,255,255,0.05) inset",
      }}
    >
      <div
        className="rounded-[26px] overflow-hidden relative bg-[var(--color-bg)]"
        style={{ aspectRatio: "9 / 19.5" }}
      >
        {/* Flex column for status bar + IG chrome + content + bottom toolbar */}
        <div className="absolute inset-0 flex flex-col">
          {/* iOS status bar */}
          <div className="relative h-[26px] flex items-center justify-between px-4 text-[9.5px] font-semibold text-[var(--color-fg)] shrink-0">
            <span className="tnum">9:41</span>
            <span aria-hidden className="absolute left-1/2 top-1 -translate-x-1/2 w-[60px] h-[16px] rounded-full bg-black" />
            <span className="text-[9px] font-mono">5G</span>
          </div>
          {/* IG top chrome */}
          <div className="border-b border-black/10 shrink-0" style={{ background: "#1c1d24", color: "#fff" }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <svg viewBox="0 0 16 16" className="size-2.5 text-white/90" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
              <div className="flex-1 min-w-0 text-center text-[10px] font-medium truncate">{brand.domain}</div>
              <svg viewBox="0 0 16 16" className="size-3 text-white/90" fill="currentColor">
                <circle cx="3" cy="8" r="1.2" />
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="13" cy="8" r="1.2" />
              </svg>
            </div>
          </div>
          {/* Content fills remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <MockContent />
          </div>
          {/* IG bottom toolbar */}
          <div
            className="h-[24px] flex items-center justify-around text-white/70 text-[8px] shrink-0"
            style={{ background: "#1c1d24", borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span>‹</span><span>›</span><span>↗</span><span>○</span>
          </div>
        </div>
        {/* Variant overlays — direct children of the outer screen so bottom/top
            positioning measures from the actual screen edges, not an inner wrapper. */}
        {children}
        {/* Home indicator on top of everything */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[3px] w-[60px] h-[2.5px] rounded-full bg-white/85 z-10 pointer-events-none" />
      </div>
    </div>
  );
}

function MockContent() {
  return (
    <div className="px-3 pt-3 pb-3 h-full overflow-hidden">
      <div className="flex justify-center mb-2.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-1.5 py-[1px] text-[7.5px] text-[var(--color-fg-dim)]">
          <span className="size-[3px] rounded-full bg-[var(--color-success)]" />
          Now in private beta
        </span>
      </div>
      <h2 className="text-center text-balance">
        <span className="block h-display text-[13px] leading-[1.05] text-[var(--color-fg)]">
          Your Instagram ads work.
        </span>
        <span className="block mt-0.5 h-editorial text-[13px] leading-[1.05] text-[var(--color-accent)]">
          Your Instagram checkout doesn&apos;t.
        </span>
      </h2>
      <p className="mt-2 text-center text-[7.5px] leading-snug text-[var(--color-fg-dim)]">
        Every paid IG ad click opens inside Instagram&apos;s broken in-app browser.
        EscapeHatch reopens your store in Safari before checkout loads.
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {[
          { v: "+47%", l: "Lift" },
          { v: "$184k", l: "Recovered" },
          { v: "1.1KB", l: "Snippet" },
        ].map((p) => (
          <div key={p.l} className="text-center px-1 py-1 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)]/60">
            <div className="text-[8px] font-semibold tnum">{p.v}</div>
            <div className="text-[6px] text-[var(--color-fg-muted)]">{p.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 6 variants ─── */

const VARIANTS: Variant[] = [
  {
    key: "a-pill",
    name: "A · Floating pill (current)",
    desc: "White rounded pill, bottom-center, soft shadow. Discreet, classic, doesn't dominate. What ships today.",
    render: () => (
      <div className="absolute left-0 right-0 bottom-[40px] flex justify-center px-3">
        <span
          className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold tracking-tight rounded-full bg-white text-black px-3 py-2 whitespace-nowrap"
          style={{ boxShadow: "0 8px 20px rgba(0,0,0,.5)" }}
        >
          Tap to open in browser →
        </span>
      </div>
    ),
  },
  {
    key: "b-bottom-banner",
    name: "B · Bottom banner",
    desc: "Full-width bar, more directive. Higher conversion likely — harder to ignore. Riskier brand-wise; looks more like a system prompt.",
    render: () => (
      <div className="absolute left-0 right-0 bottom-[24px]">
        <div className="bg-[var(--color-fg)] text-[var(--color-bg)] px-3 py-2.5 flex items-center justify-between gap-2 shadow-lg">
          <div className="min-w-0">
            <div className="text-[9px] font-semibold tracking-tight truncate">Open in Safari for the best experience</div>
            <div className="text-[7px] opacity-70 truncate">Apple Pay & saved logins are missing here</div>
          </div>
          <span className="text-[8.5px] font-bold tracking-wide px-2 py-1 rounded-md bg-[var(--color-accent)] whitespace-nowrap">
            OPEN →
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "c-modal-sheet",
    name: "C · Bottom sheet",
    desc: "Slide-up sheet with a clear primary CTA. Most native-feeling. Reads as a polite system suggestion, not an ad.",
    render: () => (
      <>
        <div className="absolute left-0 right-0 top-0 bottom-[24px] bg-black/40" />
        <div
          className="absolute left-0 right-0 bottom-[24px] bg-[var(--color-card)] rounded-t-2xl px-4 pt-3 pb-4 border-t border-[var(--color-border-soft)]"
          style={{ boxShadow: "0 -20px 40px rgba(0,0,0,0.2)" }}
        >
          <div className="mx-auto w-8 h-1 rounded-full bg-[var(--color-fg-muted)]/40 mb-3" />
          <div className="text-[10.5px] font-semibold tracking-tight text-center">Open in Safari?</div>
          <div className="mt-1 text-[8.5px] text-[var(--color-fg-dim)] text-center leading-tight">
            Apple Pay & saved info don&apos;t work in the in-app browser.
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <span className="bg-[var(--color-fg)] text-[var(--color-bg)] text-[10px] font-semibold text-center py-2 rounded-lg">
              Open in Safari
            </span>
            <span className="text-[var(--color-fg-muted)] text-[9px] text-center py-1">Continue here</span>
          </div>
        </div>
      </>
    ),
  },
  {
    key: "d-top-toast",
    name: "D · Top toast",
    desc: "Slim notification ribbon below IG chrome. Least intrusive — minimal visual weight, easy to dismiss. Lower conversion, highest brand trust.",
    render: () => (
      <div className="absolute left-0 right-0 top-[56px]">
        <div
          className="mx-3 px-2.5 py-1.5 rounded-lg bg-[var(--color-fg)] text-[var(--color-bg)] flex items-center justify-between gap-2"
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}
        >
          <div className="min-w-0">
            <div className="text-[9px] font-semibold tracking-tight truncate">For full features →</div>
          </div>
          <span className="text-[8px] font-mono tracking-wider whitespace-nowrap underline underline-offset-2">
            Open in Safari
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "e-inline-card",
    name: "E · Inline content card",
    desc: "Natural part of the page flow, not floating. Highest brand integration. Doesn't feel like an interrupter but also gets scrolled past.",
    render: () => (
      <div className="absolute left-3 right-3 bottom-[40px]">
        <div className="rounded-xl border-2 border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-2.5">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-[var(--color-accent)] grid place-items-center text-white text-[10px] font-bold shrink-0">→</span>
            <div className="min-w-0">
              <div className="text-[9px] font-semibold tracking-tight text-[var(--color-fg)] truncate">Better in Safari</div>
              <div className="text-[7.5px] text-[var(--color-fg-dim)] truncate">Tap to switch — keeps your cart</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "f-side-tab",
    name: "F · Side tab",
    desc: "Partial tab on the right edge — peeks in, very low-key. Mobile-platform-native pattern (Notion side tab style). Discreet, brand-on, but easy to miss.",
    render: () => (
      <div className="absolute top-1/2 -translate-y-1/2 right-0">
        <div
          className="bg-[var(--color-fg)] text-[var(--color-bg)] py-2.5 px-2 rounded-l-md flex items-center gap-1.5"
          style={{ boxShadow: "-4px 4px 12px rgba(0,0,0,0.18)", writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          <span className="text-[8px] font-semibold tracking-wide whitespace-nowrap">OPEN IN BROWSER</span>
        </div>
      </div>
    ),
  },
];
