import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight, Calendar } from "lucide-react";
import { cardClass, mutedClass, variantStyles } from "@/components/ui/kit";

interface YearCardProps {
  label: string;
  basePath: string;
  variant: "cours" | "devoirs";
  isRecent?: boolean;
  index?: number;
}

export function YearCard({ label, basePath, variant, isRecent = false, index }: YearCardProps) {
  return (
    <Link
      href={`${basePath}/${label}`}
      aria-label={`Ann\u00e9e ${label}`}
      style={index !== undefined ? ({ "--tbl-i": Math.min(index, 8) } as CSSProperties) : undefined}
      className={`group flex items-center justify-between gap-3 ${cardClass} ${variantStyles[variant].hoverBorder} ${index !== undefined ? "tbl-reveal" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-[var(--radius-rounded)] shrink-0 ${variantStyles[variant].iconBox}`}>
          <Calendar size={20} aria-hidden="true" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[color:var(--color-text)]">{label}</p>
          {isRecent && (
            <span className={`rounded-full bg-[color:var(--color-page-background)] border border-[color:var(--color-border)] px-2 py-0.5 text-xs font-medium ${mutedClass}`}>
              R&eacute;cente
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        size={18}
        aria-hidden="true"
        className={`${mutedClass} group-hover:translate-x-0.5 transition-transform shrink-0`}
      />
    </Link>
  );
}
