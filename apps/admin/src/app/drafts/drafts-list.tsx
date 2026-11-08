"use client";

import { useId, useMemo, useState } from "react";
import { filterFiles, filterPrograms } from "@/lib/files-filter.mjs";
import { FileText, Layers, Search, X } from "lucide-react";
import {
  AdminCard,
  AdminLinkCard,
  adminFieldClass,
} from "@/components/admin-ui";
import { PublishDraftForm } from "./publish-draft-form";

type DraftListItem = {
  id: string;
  kind: "resource" | "assignment";
  title: string;
  createdAt: string;
  subjectName: string;
  levelName: string;
  programName: string;
  programStatus: "draft" | "published";
  status: "draft";
  academicYearLabel: string;
};

type Props = {
  universityId: string;
  programs: { id: string; name: string }[];
  files: DraftListItem[];
};

function DraftSearch({
  query,
  onQueryChange,
  placeholder,
  resultCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  resultCount: number;
}) {
  const inputId = useId();
  const resultsId = useId();

  return (
    <div className="mb-5 w-full md:max-w-sm">
      <div className="relative">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-foreground)]"
        />
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onQueryChange("");
          }}
          placeholder={placeholder}
          aria-label={placeholder.replace("…", "")}
          aria-describedby={resultsId}
          className={`${adminFieldClass} h-10 py-0 pl-10 ${query ? "pr-10" : ""}`}
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-page-background)] hover:text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--color-ring)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p id={resultsId} className="mt-2 text-sm text-[color:var(--color-muted-foreground)]" aria-live="polite">
        {resultCount} {resultCount === 1 ? "résultat" : "résultats"}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AdminCard className="flex flex-col items-center py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[color:var(--admin-icon-background)] text-[color:var(--admin-icon-color)]">
        <FileText size={22} aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-semibold text-[color:var(--color-text)]">{title}</h2>
      <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">{description}</p>
    </AdminCard>
  );
}

export function DraftProgramsList({
  universityId,
  programs,
}: Pick<Props, "universityId" | "programs">) {
  const [query, setQuery] = useState("");
  const matchingPrograms = useMemo(
    () => filterPrograms(programs, query),
    [programs, query],
  );

  return (
    <>
      <DraftSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Rechercher une filière…"
        resultCount={matchingPrograms.length}
      />
      {matchingPrograms.length === 0 ? (
        <EmptyState
          title={programs.length === 0 ? "Aucune filière en brouillon" : "Aucun résultat"}
          description={programs.length === 0
            ? "Les nouvelles filières en attente de publication apparaîtront ici."
            : "Essaie un autre nom de filière."}
        />
      ) : (
        <ul className="space-y-4">
          {matchingPrograms.map((program) => (
            <li key={program.id}>
              <AdminLinkCard
                href={"/structure/" + universityId + "/programs/" + program.id}
                icon={Layers}
                title={program.name}
                description="Les fichiers de cette filière restent invisibles sur le site."
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function DraftFilesList({
  universityId,
  files,
}: Pick<Props, "universityId" | "files">) {
  const [query, setQuery] = useState("");
  const matchingDrafts = useMemo(
    () => filterFiles(files, query, "all"),
    [files, query],
  );

  return (
    <>
      <DraftSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Rechercher un fichier…"
        resultCount={matchingDrafts.length}
      />
      {matchingDrafts.length === 0 ? (
        <EmptyState
          title={files.length === 0 ? "Aucun fichier en brouillon" : "Aucun résultat"}
          description={files.length === 0
            ? "Les cours et devoirs envoyés en brouillon apparaîtront ici."
            : "Essaie un autre titre, une filière, un niveau ou une matière."}
        />
      ) : (
        <ul className="space-y-4">
          {matchingDrafts.map((draft) => (
            <li key={draft.kind + ":" + draft.id}>
              <AdminCard className="p-4">
                <h2 className="font-semibold">{draft.title}</h2>
                <p>{draft.kind === "resource" ? "Cours" : "Devoir"}</p>
                <p>{draft.programName + ", " + draft.levelName + ", " + draft.subjectName}</p>
                <p>{new Date(draft.createdAt).toLocaleDateString("fr-FR")}</p>
                {draft.programStatus === "draft" && (
                  <p>
                    Filière en brouillon : ce fichier restera invisible sur le site tant que la filière n'est pas publiée.
                  </p>
                )}
                <PublishDraftForm
                  universityId={universityId}
                  kind={draft.kind}
                  id={draft.id}
                />
              </AdminCard>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
