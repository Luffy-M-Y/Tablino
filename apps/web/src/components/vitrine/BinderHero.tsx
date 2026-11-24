import { BookOpen, ChevronRight, FileText } from "lucide-react";

// Illustration du produit : le chemin Filière › Niveau › Année › Matière se
// construit, puis la fiche de la matière s'ouvre. Contenu fictif, purement
// illustratif. Animation CSS unique au chargement (désactivée si l'utilisateur
// réduit les animations).
const PATH = [
  { label: "Filière", value: "Communication" },
  { label: "Niveau", value: "L2" },
  { label: "Année", value: "2026-2027" },
  { label: "Matière", value: "Droit des médias" },
];

const FILES = [
  { icon: BookOpen, kind: "Cours", title: "Chapitre 3 — La liberté de la presse", meta: "PDF · 18 pages" },
  { icon: BookOpen, kind: "Cours", title: "Chapitre 4 — Le droit à l’image", meta: "PDF · 12 pages" },
  { icon: FileText, kind: "Devoir", title: "Commentaire d’arrêt", meta: "À rendre le 12 décembre" },
];

export function BinderHero() {
  return (
    <figure
      aria-label="Illustration : une matière ouverte dans Tablino, avec ses cours et son devoir"
      className="relative mx-auto w-full max-w-lg"
    >
      <div aria-hidden="true" className="absolute -inset-x-4 -bottom-4 top-6 rounded-[1.5rem] bg-[color:var(--color-brand)]/10" />
      <div className="relative overflow-hidden rounded-[1.25rem] border border-[color:var(--color-border)] bg-white shadow-[0_24px_60px_-24px_rgb(15_42_94/45%)]">
        <div className="flex items-center gap-2 bg-[color:var(--color-brand)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/40" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/40" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/40" aria-hidden="true" />
          <span className="ml-2 text-xs font-medium text-white/80">Tablino</span>
        </div>

        <ol className="flex flex-wrap items-center gap-1 border-b border-[color:var(--color-border)] px-4 py-3 text-xs">
          {PATH.map((step, index) => (
            <li key={step.label} className="vt-step flex items-center gap-1" style={{ ["--vt-i" as string]: index }}>
              {index > 0 && <ChevronRight size={14} className="text-[color:var(--color-muted-foreground)]" aria-hidden="true" />}
              <span className="rounded-full bg-[color:var(--color-surface)] px-2.5 py-1">
                <span className="text-[color:var(--color-muted-foreground)]">{step.label} </span>
                <span className="font-semibold text-[color:var(--color-foreground)]">{step.value}</span>
              </span>
            </li>
          ))}
        </ol>

        <ul className="space-y-2 p-4">
          {FILES.map((file, index) => (
            <li
              key={file.title}
              className="vt-file flex items-center gap-3 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-3 transition-colors duration-200 hover:border-[color:var(--color-primary)] hover:bg-blue-50/50 motion-reduce:transition-none"
              style={{ ["--vt-i" as string]: index }}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-rounded)] ${
                  file.kind === "Devoir"
                    ? "bg-orange-50 text-[color:var(--color-accent)]"
                    : "bg-blue-50 text-[color:var(--color-primary)]"
                }`}
              >
                <file.icon size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[color:var(--color-foreground)]">{file.title}</span>
                <span className="block text-xs text-[color:var(--color-muted-foreground)]">
                  {file.kind} · {file.meta}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
