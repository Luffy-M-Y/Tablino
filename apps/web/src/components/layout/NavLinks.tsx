"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Home, X, Menu } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/cours", label: "Cours", icon: BookOpen },
  { href: "/devoirs", label: "Devoirs", icon: FileText },
];

export function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? "bg-uni-600 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile burger */}
      <button
        className="md:hidden p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
      </button>

      {/* Mobile menu */}
      {open && (
        <div
          id="mobile-menu"
          className="absolute top-full left-0 right-0 bg-uni-900 border-t border-white/10 md:hidden z-50"
        >
          <nav aria-label="Navigation mobile" className="flex flex-col p-3 gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                    ${active
                      ? "bg-uni-600 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
