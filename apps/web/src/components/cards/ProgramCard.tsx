import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cardClass, mutedClass, variantStyles } from "@/components/ui/kit";

interface ProgramCardProps {
  name: string;
  slug: string;
  levelCount: number;
  subjectCount: number;
  basePath: "/cours" | "/devoirs";
  index?: number;
}

export function ProgramCard({ name, slug, levelCount, subjectCount, basePath, index }: ProgramCardProps) {
  const variant = basePath === "/devoirs" ? "devoirs" : "cours";

  return (
    <Link
      href={`${basePath}/${slug}`}
      aria-label={`${name} — ${levelCount} niveau${levelCount !== 1 ? "x" : ""}, ${subjectCount} mati\u00e8re${subjectCount !== 1 ? "s" : ""}`}
      style={index !== undefined ? ({ "--tbl-i": Math.min(index, 8) } as CSSProperties) : undefined}
      className={`group flex items-center justify-between gap-3 ${cardClass} ${variantStyles[variant].hoverBorder} ${index !== undefined ? "tbl-reveal" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-[var(--radius-rounded)] text-lg font-bold shrink-0 ${variantStyles[variant].iconBox}`}>
          {(name.replace(/^\[.*?\]\s*/, "") || name).charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-[color:var(--color-text)]">{name}</p>
          <p className={`text-sm ${mutedClass} mt-0.5`}>
            {levelCount} niveau{levelCount !== 1 ? "x" : ""} &middot; {subjectCount} mati&egrave;re{subjectCount !== 1 ? "s" : ""}
          </p>
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
