export const instant = false;

import { notFound } from "next/navigation";
import { FileText, FileX, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import {
  getProgramBySlug,
  getLevelBySlug,
  getAcademicYearByLabel,
  getSubjectBySlug,
  getAssignmentsBySubject,
} from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { PageHero, mutedClass, cardClass } from "@/components/ui/kit";

const STEPS = [
  { label: "Fili\u00e8re" },
  { label: "Niveau" },
  { label: "Ann\u00e9e" },
  { label: "Mati\u00e8re" },
  { label: "Devoirs" },
];

function getDueStatus(dueDate: Date | null): { label: string; color: string; Icon: typeof Clock } {
  if (!dueDate) return { label: "Pas d'\u00e9ch\u00e9ance", color: mutedClass, Icon: Clock };
  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: "Expir\u00e9", color: "text-[color:var(--color-destructive-text)] font-semibold", Icon: AlertCircle };
  if (days <= 7) return { label: "\u00c0 rendre dans " + days + " jour" + (days > 1 ? "s" : ""), color: "text-[color:var(--color-text)] font-semibold", Icon: Clock };
  return { label: "\u00c0 rendre le " + dueDate.toLocaleDateString("fr-FR"), color: "text-[color:var(--color-primary-text)]", Icon: CheckCircle };
}

export default async function DevoirsListePage({
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

  const assignments = await getAssignmentsBySubject(universityId, subject.id);

  const programLabel = program.name.replace(/^\[.*?\]\s*/, "") || program.name;
  const subjectLabel = subject.name.replace(/^\[.*?\]\s*/, "") || subject.name;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <PageHero variant="devoirs" icon={FileText} title={subjectLabel} subtitle={<>{programLabel} &mdash; {level.name} &mdash; {year}</>} />

      <Breadcrumb
        items={[
          { label: "Devoirs", href: "/devoirs" },
          { label: programLabel, href: `/devoirs/${programSlug}` },
          { label: level.name, href: `/devoirs/${programSlug}/${levelSlug}` },
          { label: year, href: `/devoirs/${programSlug}/${levelSlug}/${year}` },
          { label: subjectLabel },
        ]}
      />
      <StepIndicator steps={STEPS} currentStep={5} variant="devoirs" />

      <h2 className="text-xl font-bold text-[color:var(--color-text)] mb-1">Devoirs publi&eacute;s</h2>
      <p className={`text-sm ${mutedClass} mb-6`}>
        {assignments.length} devoir{assignments.length !== 1 ? "s" : ""} publi&eacute;{assignments.length !== 1 ? "s" : ""}
      </p>

      {assignments.length === 0 ? (
        <p className={`text-sm ${mutedClass} py-8 text-center`}>
          Aucun devoir disponible pour cette mati&egrave;re.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((a) => {
            const { label: statusLabel, color, Icon: StatusIcon } = getDueStatus(a.dueDate);
            const title = a.title.replace(/^\[.*?\]\s*/, "") || a.title;

            return (
              <div
                key={a.id}
                className={cardClass}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[color:var(--color-text)]">{title}</p>
                    {a.instructions && (
                      <p className={`text-sm ${mutedClass} mt-1 line-clamp-2`}>{a.instructions}</p>
                    )}
                    <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${color}`}>
                      <StatusIcon size={13} aria-hidden="true" />
                      {statusLabel}
                    </div>
                  </div>

                  {a.fileKey ? (
                    <div
                      aria-disabled="true"
                      aria-label="T\u00e9l\u00e9chargement bient\u00f4t disponible"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-rounded)] bg-[color:var(--color-page-background)] border border-[color:var(--color-border)] ${mutedClass} text-sm font-medium cursor-not-allowed shrink-0`}
                      title="Le t\u00e9l\u00e9chargement sera disponible prochainement"
                    >
                      <Clock size={15} aria-hidden="true" />
                      Bient&ocirc;t disponible
                    </div>
                  ) : (
                    <div
                      aria-label="Fichier non disponible"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-rounded)] bg-[color:var(--color-page-background)] border border-[color:var(--color-border)] ${mutedClass} text-sm font-medium cursor-not-allowed shrink-0`}
                      title="Ce fichier n'est pas encore disponible"
                    >
                      <FileX size={15} aria-hidden="true" />
                      Indisponible
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
