"use client";

import { GraduationCap, Menu, X } from "lucide-react";
import { useState } from "react";
import { focusRing } from "@/components/ui/kit";

const NAV_LINKS = [
  { href: "#fonctionnement", label: "Fonctionnement" },
  { href: "#etudiants", label: "Étudiants" },
  { href: "#universites", label: "Universités" },
  { href: "#offres", label: "Offres" },
  { href: "#faq", label: "FAQ" },
];

const linkClass = `rounded-[var(--radius-rounded)] px-3 py-2 text-sm font-medium text-[color:var(--color-foreground)] hover:bg-[color:var(--color-background)] ${focusRing}`;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-border)] bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#haut" className={`flex items-center gap-2 rounded-[var(--radius-rounded)] ${focusRing}`} aria-label="Tablino, haut de page">
          <GraduationCap size={28} className="text-[color:var(--color-brand)]" aria-hidden="true" />
          <span className="text-lg font-bold text-[color:var(--color-brand)]">Tablino</span>
        </a>

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={linkClass}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <a
            href="#commencer"
            className={`inline-flex h-10 items-center rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-4 text-sm font-semibold text-[color:var(--color-foreground)] hover:bg-[color:var(--color-background)] ${focusRing}`}
          >
            Se connecter
          </a>
          <a
            href="#commencer"
            className={`inline-flex h-10 items-center rounded-[var(--radius-rounded)] bg-[color:var(--color-accent)] px-4 text-sm font-semibold text-[color:var(--color-on-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_90%,black)] ${focusRing}`}
          >
            Essayer gratuitement
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="menu-mobile"
          className={`inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-rounded)] text-[color:var(--color-foreground)] lg:hidden ${focusRing}`}
        >
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          <span className="sr-only">{open ? "Fermer le menu" : "Ouvrir le menu"}</span>
        </button>
      </div>

      {open && (
        <nav id="menu-mobile" aria-label="Navigation mobile" className="border-t border-[color:var(--color-border)] bg-white lg:hidden">
          <ul className="mx-auto max-w-6xl space-y-1 px-4 py-3 sm:px-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => setOpen(false)} className={`block ${linkClass}`}>
                  {link.label}
                </a>
              </li>
            ))}
            <li className="grid gap-2 pt-2 sm:hidden">
              <a
                href="#commencer"
                onClick={() => setOpen(false)}
                className={`inline-flex h-11 items-center justify-center rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] font-semibold ${focusRing}`}
              >
                Se connecter
              </a>
              <a
                href="#commencer"
                onClick={() => setOpen(false)}
                className={`inline-flex h-11 items-center justify-center rounded-[var(--radius-rounded)] bg-[color:var(--color-accent)] font-semibold text-[color:var(--color-on-accent)] ${focusRing}`}
              >
                Essayer gratuitement
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
