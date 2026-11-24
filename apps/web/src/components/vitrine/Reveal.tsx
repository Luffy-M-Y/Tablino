"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Apparition au défilement. Le contenu est visible sans JavaScript ; il n'est
// masqué que s'il est hors écran au montage, puis révélé une seule fois.
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "waiting" | "shown">("static");

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    setState("waiting");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const stateClass = state === "waiting" ? "vt-reveal-wait" : state === "shown" ? "vt-reveal-in" : "";
  return (
    <div ref={ref} className={`${stateClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
