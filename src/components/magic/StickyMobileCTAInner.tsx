"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function StickyMobileCTAInner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`pointer-events-auto p-3 transition-transform duration-300 ease-out ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      style={{
        background:
          "linear-gradient(to top, var(--color-bg) 60%, color-mix(in srgb, var(--color-bg) 60%, transparent) 100%)",
      }}
    >
      <Link
        href="#waitlist"
        className="block w-full text-center py-3 rounded-full bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[14px] font-medium press lift focus-ring"
        style={{ boxShadow: "var(--shadow-cta)" }}
      >
        Start free · 60-second install →
      </Link>
    </div>
  );
}
