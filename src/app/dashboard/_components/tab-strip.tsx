"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/install", label: "Install" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function TabStrip() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-none">
      {TABS.map((t) => {
        const active =
          t.href === "/dashboard" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative px-3 py-3 text-[13px] tracking-tight transition-colors focus-ring rounded-t-md ${
              active
                ? "text-[var(--color-fg)] font-medium"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-dim)]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
            {active ? (
              <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-[var(--color-fg)] rounded-full" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
