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
    <div className="flex items-center gap-3 mb-4">
      {/* Bouton Retour */}
      {showBack && (
        <Link
          href={backHref}
          aria-label="Retour à la page précédente"
          className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-[color:var(--color-surface)] px-3 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-page-background)] motion-reduce:transition-none ${focusRing}`}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Retour</span>
        </Link>
      )}

      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className={`flex items-center gap-1 text-sm ${mutedClass} flex-wrap`}>
        <Link
          href="/"
          aria-label="Accueil"
          className="flex items-center text-[color:var(--color-primary-text)] hover:underline transition-colors"
        >
          <Home size={14} aria-hidden="true" />
        </Link>

        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={14} aria-hidden="true" className={mutedClass} />
            {item.href ? (
              <Link
                href={item.href}
                className="text-[color:var(--color-primary-text)] underline underline-offset-2 transition-colors"
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
