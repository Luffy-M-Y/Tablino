"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ChevronRight, ArrowLeft } from "lucide-react";

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
          aria-label="Retour à la page précédente"
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-uni-50 text-uni-700 hover:bg-uni-100 transition-colors shrink-0"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
      )}

      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm text-slate-500 flex-wrap">
        <Link
          href="/"
          aria-label="Accueil"
          className="flex items-center hover:text-uni-700 transition-colors"
        >
          <Home size={14} aria-hidden="true" />
        </Link>

        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={14} aria-hidden="true" className="text-slate-300" />
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-uni-700 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-800 font-medium" aria-current="page">
                {item.label}
              </span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}
