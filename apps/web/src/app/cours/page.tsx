import { BookOpen } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import { getPrograms } from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { ProgramCard } from "@/components/cards/ProgramCard";
import { PageHero, mutedClass } from "@/components/ui/kit";

const STEPS = [
  { label: "Fili\u00e8re" },
  { label: "Niveau" },
  { label: "Ann\u00e9e" },
  { label: "Mati\u00e8re" },
  { label: "Ressources" },
];

export default async function CoursPage() {
  const universityId = await getCurrentUniversityId();
  const programs = await getPrograms(universityId);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <PageHero variant="cours" icon={BookOpen} title="Cours" subtitle="Acc&eacute;dez &agrave; vos ressources p&eacute;dagogiques" />

      <Breadcrumb items={[{ label: "Cours" }]} />
      <StepIndicator steps={STEPS} currentStep={1} variant="cours" />

      <h2 className="text-xl font-bold text-[color:var(--color-text)] mb-1">Choisissez votre fili&egrave;re</h2>
      <p className={`text-sm ${mutedClass} mb-6`}>
        S&eacute;lectionnez une fili&egrave;re pour afficher les niveaux disponibles.
      </p>

      {programs.length === 0 ? (
        <p className={`text-sm ${mutedClass} py-8 text-center`}>
          Aucune fili&egrave;re disponible pour le moment.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((p, i) => (
            <ProgramCard
              key={p.id}
              name={p.name}
              slug={p.slug}
              levelCount={p.levelCount}
              subjectCount={p.subjectCount}
              basePath="/cours"
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
