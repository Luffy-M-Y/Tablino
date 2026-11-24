"use client";

import type { MouseEvent, ReactNode } from "react";

export const UNIVERSITY_FINDER_INPUT_ID = "recherche-universite";

// Raccourci vers la recherche : fait défiler jusqu'au champ et y place le
// curseur. Sans JavaScript, le lien d'ancre suffit.
export function FindUniversityLink({
  className,
  children,
  ariaLabel,
}: {
  className: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const input = document.getElementById(UNIVERSITY_FINDER_INPUT_ID);
    if (!(input instanceof HTMLInputElement)) return;
    event.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    input.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    input.focus({ preventScroll: true });
  }

  return (
    <a href={`#${UNIVERSITY_FINDER_INPUT_ID}`} onClick={handleClick} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
