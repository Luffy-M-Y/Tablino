"use client";

import { useId, useMemo, useState } from "react";
import { filterFiles, filterPrograms } from "@/lib/files-filter.mjs";
import Link from "next/link";
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

export function DraftsList({ universityId, programs, files }: Props) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const matchingDrafts = useMemo(
    () => filterFiles(files, query, "all"),
    [files, query],
  );
  const matchingPrograms = useMemo(
    () => filterPrograms(programs, query),
    [programs, query],
  );

  return (
    <div>
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
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
          {matchingPrograms.length + matchingDrafts.length} {matchingPrograms.length + matchingDrafts.length === 1 ? "résultat" : "résultats"}
        </p>
      </section>
      <section className="mt-6 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="font-semibold">Filières en brouillon</h2>
        {matchingPrograms.length === 0 ? (
          <p>{programs.length === 0 ? "Aucune filière en brouillon." : "Aucune filière trouvée."}</p>
        ) : (
          <ul className="space-y-4">
            {matchingPrograms.map((program) => (
              <li
                key={program.id}
                className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-4"
              >
                <p>{program.name}</p>
                <p>Les fichiers de cette filière restent invisibles sur le site.</p>
                <Link href={"/structure/" + universityId + "/programs/" + program.id}>
                  Ouvrir la filière
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-6 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="font-semibold">Fichiers en brouillon</h2>
        {matchingDrafts.length === 0 ? (
          <p>{files.length === 0 ? "Aucun brouillon." : "Aucun résultat."}</p>
        ) : (
          <ul className="space-y-4">
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
      </section>
    </div>
  );
}
