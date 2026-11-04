export const instant = false;

import Link from "next/link";
import { BookOpen, FileText, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { getCurrentUniversityId } from "@/lib/university";
import { getHomeCounts } from "@/lib/queries";
import { focusRing } from "@/components/ui/kit";

export default async function HomePage() {
  const universityId = await getCurrentUniversityId();
  const { resourceCount, assignmentCount } = await getHomeCounts(universityId);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <section
        className="tbl-reveal rounded-[var(--radius-rounded)] bg-[color:var(--color-band)] p-8 sm:p-12 mb-8"
        style={{ "--tbl-i": 0 } as CSSProperties}
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-[color:var(--color-on-band)] mb-2">
          Bienvenue sur Tablino
        </h1>
        <p className="text-[color:var(--color-on-band-muted)]">
          Acc&eacute;dez &agrave; vos ressources p&eacute;dagogiques et &agrave; vos devoirs universitaires.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cours */}
        <Link
          href="/cours"
          aria-label={`Cours — ${resourceCount} ressource${resourceCount !== 1 ? "s" : ""} publi\u00e9e${resourceCount !== 1 ? "s" : ""}`}
          className={`tbl-reveal group relative overflow-hidden rounded-[var(--radius-rounded)] bg-[color:var(--color-primary)] p-8 text-white transition-transform duration-200 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none ${focusRing}`}
          style={{ "--tbl-i": 1 } as CSSProperties}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-[var(--radius-rounded)] bg-white/15">
                <BookOpen size={28} aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Cours</h2>
              <p className="text-sm mb-4">
                Acc&eacute;dez &agrave; vos ressources p&eacute;dagogiques
              </p>
              <p className="font-semibold text-lg">
                {resourceCount} ressource{resourceCount !== 1 ? "s" : ""} publi&eacute;e{resourceCount !== 1 ? "s" : ""}
              </p>
            </div>
            <ChevronRight
              size={24}
              aria-hidden="true"
              className="mt-1 group-hover:translate-x-1 transition-transform"
            />
          </div>
        </Link>

        {/* Devoirs */}
        <Link
          href="/devoirs"
          aria-label={`Devoirs — ${assignmentCount} devoir${assignmentCount !== 1 ? "s" : ""} publi\u00e9${assignmentCount !== 1 ? "s" : ""}`}
          className={`tbl-reveal group relative overflow-hidden rounded-[var(--radius-rounded)] bg-[color:var(--color-accent)] p-8 text-[color:var(--color-on-accent)] transition-transform duration-200 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none ${focusRing}`}
          style={{ "--tbl-i": 2 } as CSSProperties}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-[var(--radius-rounded)] bg-black/15">
                <FileText size={28} aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Devoirs</h2>
              <p className="text-sm mb-4">
                Consultez et t&eacute;l&eacute;chargez vos sujets
              </p>
              <p className="font-semibold text-lg">
                {assignmentCount} devoir{assignmentCount !== 1 ? "s" : ""} publi&eacute;{assignmentCount !== 1 ? "s" : ""}</p>
            </div>
            <ChevronRight
              size={24}
              aria-hidden="true"
              className="mt-1 group-hover:translate-x-1 transition-transform"
            />
          </div>
        </Link>
      </div>
    </div>
  );
}
