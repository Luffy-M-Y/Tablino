import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cardClass, mutedClass, variantStyles } from "@/components/ui/kit";

interface LevelCardProps {
  name: string;
  slug: string;
  basePath: string;
  variant: "cours" | "devoirs";
  index?: number;
}

export function LevelCard({ name, slug, basePath, variant, index }: LevelCardProps) {
  return (
    <Link
      href={`${basePath}/${slug}`}
      aria-label={name}
      style={index !== undefined ? ({ "--tbl-i": Math.min(index, 8) } as CSSProperties) : undefined}
      className={`group flex items-center justify-between gap-3 ${cardClass} ${variantStyles[variant].hoverBorder} ${index !== undefined ? "tbl-reveal" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-[var(--radius-rounded)] text-lg font-bold shrink-0 ${variantStyles[variant].iconBox}`}>
          {name.charAt(0).toUpperCase()}
        </div>
        <p className="font-semibold text-[color:var(--color-text)]">{name}</p>
      </div>
      <ChevronRight
        size={18}
        aria-hidden="true"
        className={`${mutedClass} group-hover:translate-x-0.5 transition-transform shrink-0`}
      />
    </Link>
  );
}
