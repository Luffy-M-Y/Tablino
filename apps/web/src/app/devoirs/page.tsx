import { FileText } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import { getPrograms } from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { ProgramCard } from "@/components/cards/ProgramCard";
import { BackLink, PageHero, mutedClass } from "@/components/ui/kit";

const STEPS = [
  { label: "Fili\u00e8re" },
  { label: "Niveau" },
  { label: "Ann\u00e9e" },
  { label: "Mati\u00e8re" },
  { label: "Devoirs" },
];

export default async function DevoirsPage() {
  const universityId = await getCurrentUniversityId();
  const programs = await getPrograms(universityId);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <BackLink href="/" />
      <PageHero variant="devoirs" icon={FileText} title="Devoirs" subtitle="Consultez et t&eacute;l&eacute;chargez vos sujets" />

      <Breadcrumb items={[{ label: "Devoirs" }]} />
      <StepIndicator steps={STEPS} currentStep={1} variant="devoirs" />

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
              basePath="/devoirs"
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
