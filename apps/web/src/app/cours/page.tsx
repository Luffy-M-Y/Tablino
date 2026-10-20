import { BookOpen } from "lucide-react";
import { getCurrentUniversityId } from "@/lib/university";
import { getPrograms } from "@/lib/queries";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { ProgramCard } from "@/components/cards/ProgramCard";

const STEPS = [
  { label: "Filière" },
  { label: "Niveau" },
  { label: "Année" },
  { label: "Matière" },
  { label: "Ressources" },
];

export default async function CoursPage() {
  const universityId = await getCurrentUniversityId();
  const programs = await getPrograms(universityId);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-uni-800 to-uni-600 text-white p-6 mb-6 flex items-center gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/15 shrink-0">
          <BookOpen size={28} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cours</h1>
          <p className="text-white/75 text-sm">Accédez à vos ressources pédagogiques</p>
        </div>
      </div>

      <Breadcrumb items={[{ label: "Cours" }]} />
      <StepIndicator steps={STEPS} currentStep={1} variant="cours" />

      <h2 className="text-xl font-bold text-slate-800 mb-1">Choisissez votre filière</h2>
      <p className="text-slate-500 text-sm mb-6">
        Sélectionnez une filière pour afficher les niveaux disponibles.
      </p>

      {programs.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">
          Aucune filière disponible pour le moment.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((p) => (
            <ProgramCard
              key={p.id}
              name={p.name}
              slug={p.slug}
              levelCount={p.levelCount}
              subjectCount={p.subjectCount}
              basePath="/cours"
            />
          ))}
        </div>
      )}
    </div>
  );
}
