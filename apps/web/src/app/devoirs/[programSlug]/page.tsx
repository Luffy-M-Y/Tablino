export const instant = false;

import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import { getProgramBySlug, getLevelsByProgram } from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { LevelCard } from "@/components/cards/LevelCard";
import { PageHero, mutedClass } from "@/components/ui/kit";

const STEPS = [
  { label: "Fili\u00e8re" },
  { label: "Niveau" },
  { label: "Ann\u00e9e" },
  { label: "Mati\u00e8re" },
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
      <PageHero variant="devoirs" icon={FileText} title={programLabel} subtitle="Choisissez votre niveau" />

      <Breadcrumb
        items={[
          { label: "Devoirs", href: "/devoirs" },
          { label: programLabel },
        ]}
      />
      <StepIndicator steps={STEPS} currentStep={2} variant="devoirs" />

      <h2 className="text-xl font-bold text-[color:var(--color-text)] mb-1">Choisissez votre niveau</h2>
      <p className={`text-sm ${mutedClass} mb-6`}>
        S&eacute;lectionnez un niveau pour afficher les ann&eacute;es disponibles.
      </p>

      {cycles.length === 0 ? (
        <p className={`text-sm ${mutedClass} py-8 text-center`}>
          Aucun niveau disponible pour cette fili&egrave;re.
        </p>
      ) : (
        <div className="space-y-8">
          {cycles.map((cycle) => (
            <section key={cycle.id} aria-labelledby={`cycle-${cycle.id}`}>
              <h3 id={`cycle-${cycle.id}`} className="text-lg font-semibold text-[color:var(--color-text)] mb-3">
                {cycle.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cycle.levels.map((level, i) => (
                  <LevelCard
                    key={level.id}
                    name={level.name}
                    slug={level.slug}
                    basePath={`/devoirs/${programSlug}`}
                    variant="devoirs"
                    index={i}
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
