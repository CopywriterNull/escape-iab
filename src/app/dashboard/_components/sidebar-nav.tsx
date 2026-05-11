"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelIcon } from "@/components/PixelIcon";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "home" as const },
  { href: "/dashboard/install", label: "Install", icon: "terminal" as const },
  { href: "/dashboard/settings", label: "Settings", icon: "gear" as const },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="px-2 flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active =
          item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] tracking-tight transition-colors ${
              active
                ? "bg-[var(--color-card)] text-[var(--color-fg)] font-medium"
                : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)]/60"
            }`}
            style={
              active ? { boxShadow: "0 0 0 1px var(--color-border-soft) inset" } : undefined
            }
            aria-current={active ? "page" : undefined}
          >
            <PixelIcon
              name={item.icon}
              size={14}
              className={active ? "text-[var(--color-accent)]" : "text-[var(--color-fg-muted)]"}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
