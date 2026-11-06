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
import { PageHero, mutedClass } from "@/components/ui/kit";

const STEPS = [
  { label: "Fili\u00e8re" },
  { label: "Niveau" },
  { label: "Ann\u00e9e" },
  { label: "Mati\u00e8re" },
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
      <PageHero variant="devoirs" icon={FileText} title={<>{programLabel} &mdash; {level.name} &mdash; {year}</>} subtitle="Choisissez une mati&egrave;re" />

      <Breadcrumb
        items={[
          { label: "Devoirs", href: "/devoirs" },
          { label: programLabel, href: `/devoirs/${programSlug}` },
          { label: level.name, href: `/devoirs/${programSlug}/${levelSlug}` },
          { label: year },
        ]}
      />
      <StepIndicator steps={STEPS} currentStep={4} variant="devoirs" />

      <h2 className="text-xl font-bold text-[color:var(--color-text)] mb-1">Choisissez une mati&egrave;re</h2>
      <p className={`text-sm ${mutedClass} mb-6`}>
        S&eacute;lectionnez une mati&egrave;re pour acc&eacute;der aux devoirs.
      </p>

      {subjects.length === 0 ? (
        <p className={`text-sm ${mutedClass} py-8 text-center`}>
          Aucune mati&egrave;re disponible pour cette ann&eacute;e.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s, i) => (
            <SubjectCard
              key={s.id}
              name={s.name}
              slug={s.slug}
              basePath={`/devoirs/${programSlug}/${levelSlug}/${year}`}
              variant="devoirs"
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
