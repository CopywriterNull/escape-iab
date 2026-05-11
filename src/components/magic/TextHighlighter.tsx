"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps inline text in a span that draws a cobalt highlight sweep
 * once the element enters the viewport.
 */
export function TextHighlighter({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Already in view on mount? Activate immediately (after delay).
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setTimeout(() => setActive(true), delay);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.55 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [delay]);

  return (
    <span ref={ref} className={`magic-highlight ${active ? "is-active" : ""} ${className}`}>
      {children}
    </span>
  );
}
