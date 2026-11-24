export const instant = false;

import Image from "next/image";
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
        className="tbl-reveal relative mb-8 overflow-hidden rounded-[1.25rem] bg-[linear-gradient(135deg,var(--color-brand),color-mix(in_srgb,var(--color-brand)_70%,var(--color-primary)))] p-8 shadow-[0_24px_60px_-28px_rgb(15_42_94/55%)] sm:p-12"
        style={{ "--tbl-i": 0 } as CSSProperties}
      >
        <Image
          src="/icons/icon-512.png"
          alt=""
          width={220}
          height={220}
          className="pointer-events-none absolute -right-10 -top-10 hidden rotate-12 rounded-[2.5rem] opacity-15 blur-[2px] sm:block"
        />
        <h1 className="relative mb-2 text-2xl font-bold text-[color:var(--color-on-band)] sm:text-4xl">
          Bienvenue sur Tablino
        </h1>
        <p className="relative max-w-xl text-[color:var(--color-on-band-muted)]">
          Acc&eacute;dez &agrave; vos ressources p&eacute;dagogiques et &agrave; vos devoirs universitaires.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cours */}
        <div className="tbl-reveal" style={{ "--tbl-i": 1 } as CSSProperties}>
          <Link
            href="/cours"
            aria-label={`Cours — ${resourceCount} ressource${resourceCount !== 1 ? "s" : ""} publi\u00e9e${resourceCount !== 1 ? "s" : ""}`}
            className={`group relative block overflow-hidden rounded-[1.25rem] bg-[color:var(--color-primary)] p-8 text-white transition duration-300 motion-safe:hover:-translate-y-1 hover:shadow-[0_24px_50px_-20px_rgb(37_99_235/60%)] motion-reduce:transition-none ${focusRing}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[var(--radius-rounded)] bg-white/15 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100">
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
                className="mt-1 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
              />
            </div>
          </Link>
        </div>

        {/* Devoirs */}
        <div className="tbl-reveal" style={{ "--tbl-i": 2 } as CSSProperties}>
          <Link
            href="/devoirs"
            aria-label={`Devoirs — ${assignmentCount} devoir${assignmentCount !== 1 ? "s" : ""} publi\u00e9${assignmentCount !== 1 ? "s" : ""}`}
            className={`group relative block overflow-hidden rounded-[1.25rem] bg-[color:var(--color-accent)] p-8 text-[color:var(--color-on-accent)] transition duration-300 motion-safe:hover:-translate-y-1 hover:shadow-[0_24px_50px_-20px_rgb(234_88_12/60%)] motion-reduce:transition-none ${focusRing}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[var(--radius-rounded)] bg-black/15 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100">
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
                className="mt-1 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
              />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
