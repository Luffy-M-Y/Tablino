"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight, ArrowLeft } from "lucide-react";
import { focusRing, mutedClass } from "@/components/ui/kit";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const pathname = usePathname();
  const showBack = pathname !== "/";
  const backHref = [...items].reverse().find((item) => item.href)?.href ?? "/";

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      {/* Bouton Retour */}
      {showBack && (
        <Link
          href={backHref}
          aria-label="Retour à la page précédente"
          className={`group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white py-1 pl-1 pr-4 text-sm font-semibold text-[color:var(--color-text)] shadow-sm transition duration-200 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary-text)] hover:shadow-md motion-reduce:transition-none ${focusRing}`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-white transition duration-200 group-hover:-translate-x-0.5 group-hover:bg-[color:var(--color-primary)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
            <ArrowLeft size={16} aria-hidden="true" />
          </span>
          <span>Retour</span>
        </Link>
      )}

      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className={`flex min-h-11 flex-wrap items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-white/70 px-4 py-2 text-sm backdrop-blur ${mutedClass}`}>
        <Link
          href="/"
          aria-label="Accueil"
          className={`flex items-center rounded text-[color:var(--color-primary-text)] transition-transform hover:scale-110 motion-reduce:transition-none ${focusRing}`}
        >
          <Home size={14} aria-hidden="true" />
        </Link>

        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={14} aria-hidden="true" className={mutedClass} />
            {item.href ? (
              <Link
                href={item.href}
                className={`rounded text-[color:var(--color-primary-text)] underline-offset-2 hover:underline ${focusRing}`}
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[color:var(--color-text)] font-semibold" aria-current="page">
                {item.label}
              </span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}
