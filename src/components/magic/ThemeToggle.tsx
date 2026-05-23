"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const current = document.documentElement.getAttribute("data-theme") as Theme | null;
      setTheme(current === "dark" ? "dark" : "light");
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("eh-theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={`relative inline-flex size-8 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] hover:bg-[var(--color-bg-elev)] press focus-ring transition-colors ${className}`}
    >
      {/* Sun (visible in dark mode) */}
      <svg
        viewBox="0 0 24 24"
        className={`absolute size-4 transition-all duration-300 ${
          theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {/* Moon (visible in light mode) */}
      <svg
        viewBox="0 0 24 24"
        className={`absolute size-4 transition-all duration-300 ${
          theme === "dark" ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>
  );
}

/**
 * Inline script that runs before paint to apply theme.
 * Logic:
 *   - Explicit 'light' in localStorage wins (user opted out of dark).
 *   - Anything else (null / 'dark' / parse error) → dark by default.
 * Drop into <head> in app/layout.tsx to avoid the FOUC flash.
 */
export const themeBootScript = `
(function(){
  try {
    var t = localStorage.getItem('eh-theme');
    if (t !== 'light') {
      document.documentElement.setAttribute('data-theme','dark');
    }
  } catch(e) {
    document.documentElement.setAttribute('data-theme','dark');
  }
})();
`;
