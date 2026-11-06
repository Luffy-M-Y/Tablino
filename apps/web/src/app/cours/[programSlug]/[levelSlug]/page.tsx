export const instant = false;

import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import { getProgramBySlug, getLevelBySlug, getAcademicYearsByLevel } from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { YearCard } from "@/components/cards/YearCard";
import { PageHero, mutedClass } from "@/components/ui/kit";

const STEPS = [
  { label: "Fili\u00e8re" },
  { label: "Niveau" },
  { label: "Ann\u00e9e" },
  { label: "Mati\u00e8re" },
  { label: "Ressources" },
];

export default async function CoursAnneesPage({
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
      <PageHero variant="cours" icon={BookOpen} title={<>{programLabel} &mdash; {level.name}</>} subtitle="Choisissez l'ann&eacute;e acad&eacute;mique" />

      <Breadcrumb
        items={[
          { label: "Cours", href: "/cours" },
          { label: programLabel, href: `/cours/${programSlug}` },
          { label: level.name },
        ]}
      />
      <StepIndicator steps={STEPS} currentStep={3} variant="cours" />

      <h2 className="text-xl font-bold text-[color:var(--color-text)] mb-1">Choisissez l&apos;ann&eacute;e acad&eacute;mique</h2>
      <p className={`text-sm ${mutedClass} mb-6`}>
        S&eacute;lectionnez une ann&eacute;e pour afficher les mati&egrave;res disponibles.
      </p>

      {years.length === 0 ? (
        <p className={`text-sm ${mutedClass} py-8 text-center`}>
          Aucune ann&eacute;e disponible pour ce niveau.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {years.map((y, i) => (
            <YearCard
              key={y.id}
              label={y.label}
              basePath={`/cours/${programSlug}/${levelSlug}`}
              variant="cours"
              isRecent={i === 0}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
