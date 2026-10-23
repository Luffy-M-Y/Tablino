import Link from "next/link";
import { ChevronRight, Calendar } from "lucide-react";

interface YearCardProps {
  label: string;
  basePath: string;
  variant: "cours" | "devoirs";
  isRecent?: boolean;
}

export function YearCard({ label, basePath, variant, isRecent = false }: YearCardProps) {
  const accent =
    variant === "devoirs"
      ? "hover:border-teal-500 hover:bg-teal-50"
      : "hover:border-uni-500 hover:bg-uni-50";
  const iconBg =
    variant === "devoirs"
      ? "bg-teal-100 text-teal-700"
      : "bg-uni-100 text-uni-700";

  return (
    <Link
      href={`${basePath}/${label}`}
      aria-label={`Année ${label}`}
      className={`group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all ${accent}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${iconBg}`}>
          <Calendar size={20} aria-hidden="true" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-800">{label}</p>
          {isRecent && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Récente
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        size={18}
        aria-hidden="true"
        className="text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0"
      />
    </Link>
  );
}
