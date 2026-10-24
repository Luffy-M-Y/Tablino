"use client";

import { useId, useMemo, useState } from "react";
import { filterFiles } from "@/lib/files-filter.mjs";
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
  files: DraftListItem[];
};

export function DraftsList({ universityId, files }: Props) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const matchingDrafts = useMemo(
    () => filterFiles(files, query, "all"),
    [files, query],
  );

  return (
    <div>
      <div className="mt-4 flex gap-3">
        <div className="flex-1">
          <label htmlFor={inputId}>Rechercher</label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            className="mt-2 w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={() => setQuery("")}
          className="self-end rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        >
          Effacer
        </button>
      </div>
      <p className="mt-3" aria-live="polite">
        {matchingDrafts.length} {matchingDrafts.length === 1 ? "résultat" : "résultats"}
      </p>
      {matchingDrafts.length === 0 ? (
        <p className="mt-4">{files.length === 0 ? "Aucun brouillon." : "Aucun résultat."}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {matchingDrafts.map((draft) => (
            <li
              key={draft.kind + ":" + draft.id}
              className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-4"
            >
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
