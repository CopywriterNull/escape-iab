"use client";

import { useEffect, useRef } from "react";

/** Cobalt dot follows the cursor on desktop; grows over interactive elements. */
export function PointerTracker() {
  const dotRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const target = useRef({ x: -50, y: -50 });
  const current = useRef({ x: -50, y: -50 });

  useEffect(() => {
    // Pointer hover detection — skip on touch.
    if (window.matchMedia?.("(hover: none)").matches) return;

    const dot = dotRef.current;
    if (!dot) return;

    // Hide the system cursor on hover-capable devices once JS has loaded.
    document.documentElement.classList.add("has-magic-cursor");

    const onMove = (e: PointerEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      dot.classList.add("is-visible");
      // Grow over links/buttons.
      const interactive =
        (e.target as HTMLElement | null)?.closest("a,button,input,textarea,[role=tab],[role=button]") != null;
      dot.classList.toggle("is-link", interactive);
    };
    const onLeave = () => dot.classList.remove("is-visible");

    const loop = () => {
      // Lerp for smooth trailing motion.
      current.current.x += (target.current.x - current.current.x) * 0.22;
      current.current.y += (target.current.y - current.current.y) * 0.22;
      dot.style.left = `${current.current.x}px`;
      dot.style.top = `${current.current.y}px`;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.documentElement.classList.remove("has-magic-cursor");
    };
  }, []);

  return <div aria-hidden ref={dotRef} className="magic-pointer" />;
}
