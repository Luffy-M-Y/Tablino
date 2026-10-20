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

const STEPS = [
  { label: "Filière" },
  { label: "Niveau" },
  { label: "Année" },
  { label: "Matière" },
  { label: "Devoirs" },
];

function getDueStatus(dueDate: Date | null): { label: string; color: string; Icon: typeof Clock } {
  if (!dueDate) return { label: "Pas d'échéance", color: "text-slate-400", Icon: Clock };
  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: "Expiré", color: "text-red-500", Icon: AlertCircle };
  if (days <= 7) return { label: `À rendre dans ${days} jour${days > 1 ? "s" : ""}`, color: "text-amber-500", Icon: Clock };
  return { label: `À rendre le ${dueDate.toLocaleDateString("fr-FR")}`, color: "text-teal-600", Icon: CheckCircle };
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
      <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-600 text-white p-6 mb-6 flex items-center gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/15 shrink-0">
          <FileText size={28} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{subjectLabel}</h1>
          <p className="text-white/75 text-sm">{programLabel} — {level.name} — {year}</p>
        </div>
      </div>

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

      <h2 className="text-xl font-bold text-slate-800 mb-1">Devoirs publiés</h2>
      <p className="text-slate-500 text-sm mb-6">
        {assignments.length} devoir{assignments.length !== 1 ? "s" : ""} publié{assignments.length !== 1 ? "s" : ""}
      </p>

      {assignments.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">
          Aucun devoir disponible pour cette matière.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((a) => {
            const { label: statusLabel, color, Icon: StatusIcon } = getDueStatus(a.dueDate);
            const title = a.title.replace(/^\[.*?\]\s*/, "") || a.title;

            return (
              <div
                key={a.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{title}</p>
                    {a.instructions && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.instructions}</p>
                    )}
                    <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${color}`}>
                      <StatusIcon size={13} aria-hidden="true" />
                      {statusLabel}
                    </div>
                  </div>

                  {a.fileKey ? (
                    <div
                      aria-disabled="true"
                      aria-label="Téléchargement bientôt disponible"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed shrink-0"
                      title="Le téléchargement sera disponible prochainement"
                    >
                      <Clock size={15} aria-hidden="true" />
                      Bientôt disponible
                    </div>
                  ) : (
                    <div
                      aria-label="Fichier non disponible"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed shrink-0"
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
