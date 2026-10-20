export const instant = false;

import { notFound } from "next/navigation";
import { BookOpen, ExternalLink, FileX, Clock } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import {
  getProgramBySlug,
  getLevelBySlug,
  getAcademicYearByLabel,
  getSubjectBySlug,
  getResourcesBySubject,
} from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";

const STEPS = [
  { label: "Filière" },
  { label: "Niveau" },
  { label: "Année" },
  { label: "Matière" },
  { label: "Ressources" },
];

const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF",
  video: "Vidéo",
  audio: "Audio",
  docx: "Word",
  pptx: "PowerPoint",
  link: "Lien",
  other: "Fichier",
};

export default async function CoursRessourcesPage({
  params,
}: {
  params: Promise<{ programSlug: string; levelSlug: string; year: string; subjectSlug: string }>;
}) {
  const { programSlug, levelSlug, year, subjectSlug } = await params;
  const universityId = await getCurrentUniversityId();

  const program = await getProgramBySlug(universityId, programSlug);
  if (!program) notFound();

  const level = await getLevelBySlug(universityId, program.id, levelSlug);
  if (!level) notFound();

  const academicYear = await getAcademicYearByLabel(universityId, year);
  if (!academicYear) notFound();

  const subject = await getSubjectBySlug(universityId, level.id, academicYear.id, subjectSlug);
  if (!subject) notFound();

  const resources = await getResourcesBySubject(universityId, subject.id);

  const programLabel = program.name.replace(/^\[.*?\]\s*/, "") || program.name;
  const subjectLabel = subject.name.replace(/^\[.*?\]\s*/, "") || subject.name;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl bg-gradient-to-br from-uni-800 to-uni-600 text-white p-6 mb-6 flex items-center gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/15 shrink-0">
          <BookOpen size={28} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{subjectLabel}</h1>
          <p className="text-white/75 text-sm">{programLabel} — {level.name} — {year}</p>
        </div>
      </div>

      <Breadcrumb
        items={[
          { label: "Cours", href: "/cours" },
          { label: programLabel, href: `/cours/${programSlug}` },
          { label: level.name, href: `/cours/${programSlug}/${levelSlug}` },
          { label: year, href: `/cours/${programSlug}/${levelSlug}/${year}` },
          { label: subjectLabel },
        ]}
      />
      <StepIndicator steps={STEPS} currentStep={5} variant="cours" />

      <h2 className="text-xl font-bold text-slate-800 mb-1">Ressources disponibles</h2>
      <p className="text-slate-500 text-sm mb-6">
        {resources.length} ressource{resources.length !== 1 ? "s" : ""} publiée{resources.length !== 1 ? "s" : ""}
      </p>

      {resources.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">
          Aucune ressource disponible pour cette matière.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {resources.map((r) => {
            const title = r.title.replace(/^\[.*?\]\s*/, "") || r.title;
            const safeUrl = r.externalUrl && /^https?:\/\//i.test(r.externalUrl) ? r.externalUrl : null;

            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {FORMAT_LABELS[r.format] ?? r.format}
                    {r.fileSizeBytes ? ` · ${Math.round(r.fileSizeBytes / 1024)} Ko` : ""}
                  </p>
                </div>

                {safeUrl ? (
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ouvrir ${title}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-uni-600 text-white text-sm font-medium hover:bg-uni-700 transition-colors shrink-0"
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                    Ouvrir
                  </a>
                ) : (
                  <div
                    aria-disabled="true"
                    aria-label="Téléchargement bientôt disponible"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed shrink-0"
                    title="Le téléchargement sera disponible prochainement"
                  >
                    <Clock size={15} aria-hidden="true" />
                    Bientôt disponible
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
