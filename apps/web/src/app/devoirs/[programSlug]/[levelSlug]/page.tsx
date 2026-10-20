export const instant = false;

import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import { getProgramBySlug, getLevelBySlug, getAcademicYearsByLevel } from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { YearCard } from "@/components/cards/YearCard";

const STEPS = [
  { label: "Filière" },
  { label: "Niveau" },
  { label: "Année" },
  { label: "Matière" },
  { label: "Devoirs" },
];

export default async function DevoirsAnneesPage({
  params,
}: {
  params: Promise<{ programSlug: string; levelSlug: string }>;
}) {
  const { programSlug, levelSlug } = await params;
  const universityId = await getCurrentUniversityId();

  const program = await getProgramBySlug(universityId, programSlug);
  if (!program) notFound();

  const level = await getLevelBySlug(universityId, program.id, levelSlug);
  if (!level) notFound();

  const years = await getAcademicYearsByLevel(universityId, level.id);

  const programLabel = program.name.replace(/^\[.*?\]\s*/, "") || program.name;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-600 text-white p-6 mb-6 flex items-center gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/15 shrink-0">
          <FileText size={28} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{programLabel} — {level.name}</h1>
          <p className="text-white/75 text-sm">Choisissez l'année académique</p>
        </div>
      </div>

      <Breadcrumb
        items={[
          { label: "Devoirs", href: "/devoirs" },
          { label: programLabel, href: `/devoirs/${programSlug}` },
          { label: level.name },
        ]}
      />
      <StepIndicator steps={STEPS} currentStep={3} variant="devoirs" />

      <h2 className="text-xl font-bold text-slate-800 mb-1">Choisissez l'année académique</h2>
      <p className="text-slate-500 text-sm mb-6">
        Sélectionnez une année pour afficher les matières disponibles.
      </p>

      {years.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">
          Aucune année disponible pour ce niveau.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {years.map((y) => (
            <YearCard
              key={y.id}
              label={y.label}
              basePath={`/devoirs/${programSlug}/${levelSlug}`}
              variant="devoirs"
            />
          ))}
        </div>
      )}
    </div>
  );
}
