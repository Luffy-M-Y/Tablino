export const instant = false;

import Link from "next/link";
import { BookOpen, FileText, ChevronRight } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import { getHomeCounts } from "@/lib/queries";

export default async function HomePage() {
  const universityId = await getCurrentUniversityId();
  const { resourceCount, assignmentCount } = await getHomeCounts(universityId);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <h1 className="text-2xl sm:text-3xl font-bold text-uni-900 mb-2">
        Bienvenue sur Tablino
      </h1>
      <p className="text-slate-500 mb-10">
        Accédez à vos ressources pédagogiques et à vos devoirs universitaires.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cours */}
        <Link
          href="/cours"
          aria-label={`Cours — ${resourceCount} ressource${resourceCount !== 1 ? "s" : ""} publiée${resourceCount !== 1 ? "s" : ""}`}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-uni-800 to-uni-600 p-8 text-white shadow-lg hover:shadow-xl transition-shadow focus-visible:ring-2 focus-visible:ring-uni-600 focus-visible:ring-offset-2"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white/15">
                <BookOpen size={28} aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Cours</h2>
              <p className="text-white/75 text-sm mb-4">
                Accédez à vos ressources pédagogiques
              </p>
              <p className="text-white/90 font-semibold text-lg">
                {resourceCount} ressource{resourceCount !== 1 ? "s" : ""} publiée{resourceCount !== 1 ? "s" : ""}
              </p>
            </div>
            <ChevronRight
              size={24}
              aria-hidden="true"
              className="mt-1 opacity-60 group-hover:translate-x-1 transition-transform"
            />
          </div>
        </Link>

        {/* Devoirs */}
        <Link
          href="/devoirs"
          aria-label={`Devoirs — ${assignmentCount} devoir${assignmentCount !== 1 ? "s" : ""} publié${assignmentCount !== 1 ? "s" : ""}`}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 to-teal-600 p-8 text-white shadow-lg hover:shadow-xl transition-shadow focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white/15">
                <FileText size={28} aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Devoirs</h2>
              <p className="text-white/75 text-sm mb-4">
                Consultez et téléchargez vos sujets
              </p>
              <p className="text-white/90 font-semibold text-lg">
                {assignmentCount} devoir{assignmentCount !== 1 ? "s" : ""} publié{assignmentCount !== 1 ? "s" : ""}
              </p>
            </div>
            <ChevronRight
              size={24}
              aria-hidden="true"
              className="mt-1 opacity-60 group-hover:translate-x-1 transition-transform"
            />
          </div>
        </Link>
      </div>
    </div>
  );
}
