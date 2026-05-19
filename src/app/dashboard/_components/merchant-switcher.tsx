"use client";

import { useEffect, useRef, useState } from "react";
import { impersonateMerchant, stopImpersonating } from "@/app/actions/admin";

export type SwitcherRow = {
  id: string;
  name: string | null;
  domain: string | null;
  ownedByMe: boolean;
};

export function MerchantSwitcher({
  current,
  rows,
  impersonating,
}: {
  current: { id: string; name: string | null; domain: string | null } | null;
  rows: SwitcherRow[];
  impersonating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = current?.name ?? "Workspace";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12.5px] hover:bg-[var(--color-bg-elev)]/60 border border-transparent hover:border-[var(--color-border-soft)] transition-colors max-w-[260px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-medium truncate">{label}</span>
        {impersonating ? (
          <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-mono tracking-wider shrink-0">
            IMP
          </span>
        ) : null}
        <svg viewBox="0 0 12 12" className="size-2.5 text-[var(--color-fg-muted)] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1.5 w-[300px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg z-40 overflow-hidden"
          style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}
        >
          <div className="px-3 pt-2.5 pb-1.5 text-[9.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
            Switch merchant
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {rows.map((r) => {
              const isCurrent = current?.id === r.id;
              return (
                <form key={r.id} action={impersonateMerchant} className="contents">
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className={`w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-[var(--color-bg-elev)]/60 ${
                      isCurrent ? "bg-[var(--color-bg-elev)]/40" : ""
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full shrink-0 ${
                        isCurrent ? "bg-[var(--color-success)]" : "bg-[var(--color-fg-muted)]/40"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium truncate">
                        {r.name ?? "(unnamed)"}
                      </span>
                      <span className="block text-[10.5px] font-mono text-[var(--color-fg-muted)] truncate">
                        {r.domain ?? "—"}
                      </span>
                      <span className="block text-[10px] font-mono text-[var(--color-fg-muted)]/80 truncate">
                        {r.id.slice(0, 8)}…
                      </span>
                    </span>
                    {r.ownedByMe ? (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-fg)]/8 text-[var(--color-fg-muted)] font-mono tracking-wider shrink-0">
                        MINE
                      </span>
                    ) : null}
                  </button>
                </form>
              );
            })}
          </div>
          <div className="border-t border-[var(--color-border-soft)] flex items-center justify-between text-[11px]">
            {impersonating ? (
              <form action={stopImpersonating} className="contents">
                <button
                  type="submit"
                  className="px-3 py-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)]/60 transition-colors"
                >
                  Exit impersonation
                </button>
              </form>
            ) : (
              <span />
            )}
            <a
              href="/admin/merchants"
              className="px-3 py-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] font-mono"
            >
              Manage →
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
