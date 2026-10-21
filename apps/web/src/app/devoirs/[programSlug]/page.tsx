export const instant = false;

import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import { getProgramBySlug, getLevelsByProgram } from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { LevelCard } from "@/components/cards/LevelCard";

const STEPS = [
  { label: "Filière" },
  { label: "Niveau" },
  { label: "Année" },
  { label: "Matière" },
  { label: "Devoirs" },
];

export default async function DevoirsNiveauxPage({
  params,
}: {
  params: Promise<{ programSlug: string }>;
}) {
  const { programSlug } = await params;
  const universityId = await getCurrentUniversityId();

  const program = await getProgramBySlug(universityId, programSlug);
  if (!program) notFound();

  const cycles = await getLevelsByProgram(universityId, program.id);

  const programLabel = program.name.replace(/^\[.*?\]\s*/, "") || program.name;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-600 text-white p-6 mb-6 flex items-center gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/15 shrink-0">
          <FileText size={28} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{programLabel}</h1>
          <p className="text-white/75 text-sm">Choisissez votre niveau</p>
        </div>
      </div>

      <Breadcrumb
        items={[
          { label: "Devoirs", href: "/devoirs" },
          { label: programLabel },
        ]}
      />
      <StepIndicator steps={STEPS} currentStep={2} variant="devoirs" />

      <h2 className="text-xl font-bold text-slate-800 mb-1">Choisissez votre niveau</h2>
      <p className="text-slate-500 text-sm mb-6">
        Sélectionnez un niveau pour afficher les années disponibles.
      </p>

      {cycles.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">
          Aucun niveau disponible pour cette filière.
        </p>
      ) : (
        <div className="space-y-8">
          {cycles.map((cycle) => (
            <section key={cycle.id} aria-labelledby={`cycle-${cycle.id}`}>
              <h3 id={`cycle-${cycle.id}`} className="text-lg font-semibold text-slate-700 mb-3">
                {cycle.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cycle.levels.map((level) => (
                  <LevelCard
                    key={level.id}
                    name={level.name}
                    slug={level.slug}
                    basePath={`/devoirs/${programSlug}`}
                    variant="devoirs"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
