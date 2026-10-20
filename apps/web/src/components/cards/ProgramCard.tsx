import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface ProgramCardProps {
  name: string;
  slug: string;
  levelCount: number;
  subjectCount: number;
  basePath: "/cours" | "/devoirs";
}

export function ProgramCard({ name, slug, levelCount, subjectCount, basePath }: ProgramCardProps) {
  const accent = basePath === "/devoirs" ? "hover:border-teal-500 hover:bg-teal-50" : "hover:border-uni-500 hover:bg-uni-50";
  const iconBg = basePath === "/devoirs" ? "bg-teal-100 text-teal-700" : "bg-uni-100 text-uni-700";

  return (
    <Link
      href={`${basePath}/${slug}`}
      aria-label={`${name} — ${levelCount} niveau${levelCount !== 1 ? "x" : ""}, ${subjectCount} matière${subjectCount !== 1 ? "s" : ""}`}
      className={`group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all ${accent}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl text-lg font-bold shrink-0 ${iconBg}`}>
          {(name.replace(/^\[.*?\]\s*/, "") || name).charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-slate-800">{name}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {levelCount} niveau{levelCount !== 1 ? "x" : ""} · {subjectCount} matière{subjectCount !== 1 ? "s" : ""}
          </p>
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
