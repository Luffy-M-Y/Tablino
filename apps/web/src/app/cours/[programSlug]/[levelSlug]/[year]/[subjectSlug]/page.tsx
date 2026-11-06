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
import { PageHero, mutedClass, primaryButtonClass, cardClass } from "@/components/ui/kit";

const STEPS = [
  { label: "Fili\u00e8re" },
  { label: "Niveau" },
  { label: "Ann\u00e9e" },
  { label: "Mati\u00e8re" },
  { label: "Ressources" },
];

const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF",
  video: "Vid\u00e9o",
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
      <PageHero variant="cours" icon={BookOpen} title={subjectLabel} subtitle={<>{programLabel} &mdash; {level.name} &mdash; {year}</>} />

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

      <h2 className="text-xl font-bold text-[color:var(--color-text)] mb-1">Ressources disponibles</h2>
      <p className={`text-sm ${mutedClass} mb-6`}>
        {resources.length} ressource{resources.length !== 1 ? "s" : ""} publi&eacute;e{resources.length !== 1 ? "s" : ""}
      </p>

      {resources.length === 0 ? (
        <p className={`text-sm ${mutedClass} py-8 text-center`}>
          Aucune ressource disponible pour cette mati&egrave;re.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {resources.map((r) => {
            const title = r.title.replace(/^\[.*?\]\s*/, "") || r.title;
            const safeUrl = r.externalUrl && /^https?:\/\//i.test(r.externalUrl) ? r.externalUrl : null;

            return (
              <div
                key={r.id}
                className={`flex items-center justify-between gap-4 ${cardClass}`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-[color:var(--color-text)] truncate">{title}</p>
                  <p className={`text-xs ${mutedClass} mt-0.5`}>
                    {FORMAT_LABELS[r.format] ?? r.format}
                    {r.fileSizeBytes ? ` \u00b7 ${Math.round(r.fileSizeBytes / 1024)} Ko` : ""}
                  </p>
                </div>

                {safeUrl ? (
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ouvrir ${title}`}
                    className={`${primaryButtonClass} w-auto inline-flex items-center justify-center gap-1.5 shrink-0`}
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                    Ouvrir
                  </a>
                ) : (
                  <div
                    aria-disabled="true"
                    aria-label="T\u00e9l\u00e9chargement bient\u00f4t disponible"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-rounded)] bg-[color:var(--color-page-background)] border border-[color:var(--color-border)] ${mutedClass} text-sm font-medium cursor-not-allowed shrink-0`}
                    title="Le t\u00e9l\u00e9chargement sera disponible prochainement"
                  >
                    <Clock size={15} aria-hidden="true" />
                    Bient&ocirc;t disponible
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
