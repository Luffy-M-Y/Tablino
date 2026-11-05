"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ChevronRight, ArrowLeft } from "lucide-react";
import { mutedClass } from "@/components/ui/kit";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const pathname = usePathname();
  const router = useRouter();
  const showBack = pathname !== "/";

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Bouton Retour — mobile uniquement */}
      {showBack && (
        <button
          onClick={() => router.back()}
          aria-label="Retour \u00e0 la page pr\u00e9c\u00e9dente"
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] hover:bg-[color:var(--color-page-background)] transition-colors shrink-0"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
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
