export const instant = false;

import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import {
  getProgramBySlug,
  getLevelBySlug,
  getAcademicYearByLabel,
  getSubjectsByLevelAndYear,
} from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { SubjectCard } from "@/components/cards/SubjectCard";

const STEPS = [
  { label: "Filière" },
  { label: "Niveau" },
  { label: "Année" },
  { label: "Matière" },
  { label: "Devoirs" },
];

export default async function DevoirsMatieresPage({
  params,
}: {
  params: Promise<{ programSlug: string; levelSlug: string; year: string }>;
}) {
  const { programSlug, levelSlug, year } = await params;
  const universityId = await getCurrentUniversityId();

  const program = await getProgramBySlug(universityId, programSlug);
  if (!program) notFound();

  const level = await getLevelBySlug(universityId, program.id, levelSlug);
  if (!level) notFound();

  const academicYear = await getAcademicYearByLabel(universityId, year);
  if (!academicYear) notFound();

  const subjects = await getSubjectsByLevelAndYear(universityId, level.id, academicYear.id);

  const programLabel = program.name.replace(/^\[.*?\]\s*/, "") || program.name;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-600 text-white p-6 mb-6 flex items-center gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/15 shrink-0">
          <FileText size={28} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{programLabel} — {level.name} — {year}</h1>
          <p className="text-white/75 text-sm">Choisissez une matière</p>
        </div>
      </div>

      <Breadcrumb
        items={[
          { label: "Devoirs", href: "/devoirs" },
          { label: programLabel, href: `/devoirs/${programSlug}` },
          { label: level.name, href: `/devoirs/${programSlug}/${levelSlug}` },
          { label: year },
        ]}
      />
      <StepIndicator steps={STEPS} currentStep={4} variant="devoirs" />

      <h2 className="text-xl font-bold text-slate-800 mb-1">Choisissez une matière</h2>
      <p className="text-slate-500 text-sm mb-6">
        Sélectionnez une matière pour accéder aux devoirs.
      </p>

      {subjects.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">
          Aucune matière disponible pour cette année.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s) => (
            <SubjectCard
              key={s.id}
              name={s.name}
              slug={s.slug}
              basePath={`/devoirs/${programSlug}/${levelSlug}/${year}`}
              variant="devoirs"
            />
          ))}
        </div>
      )}
    </div>
  );
}
