"use client";

import { useId, useMemo, useState } from "react";
import { filterFiles, type FileFilterStatus } from "@/lib/files-filter.mjs";
import { deleteAssignmentAction, deleteResourceAction } from "../structure/[universityId]/actions";
import { DeleteControl } from "../structure/[universityId]/structure-edit-controls";

type ManagedFileListItem = {
  id: string;
  title: string;
  status: "draft" | "published";
  createdAt: string;
  programName: string;
  levelName: string;
  academicYearLabel: string;
  subjectName: string;
};

type Props = {
  universityId: string;
  kind: "resource" | "assignment";
  files: ManagedFileListItem[];
};

export function ManagedFilesList({ universityId, kind, files }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FileFilterStatus>("all");
  const inputId = useId();
  const matchingFiles = useMemo(
    () => filterFiles(files, query, status),
    [files, query, status],
  );
  const deleteAction = kind === "resource" ? deleteResourceAction : deleteAssignmentAction;
  const deleteLabel = kind === "resource" ? "Supprimer le cours" : "Supprimer le devoir";

  return (
    <div>
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="min-w-60 flex-1">
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
        <div>
          <label htmlFor={inputId + "-status"}>Statut</label>
          <select
            id={inputId + "-status"}
            value={status}
            onChange={(event) => {
              const nextStatus = event.currentTarget.value;
              if (nextStatus === "all" || nextStatus === "published" || nextStatus === "draft") {
                setStatus(nextStatus);
              }
            }}
            className="mt-2 block rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2"
          >
            <option value="all">Tous</option>
            <option value="published">Publiés</option>
            <option value="draft">Brouillons</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setStatus("all");
          }}
          className="self-end rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        >
          Effacer
        </button>
      </div>
      <p className="mt-3" aria-live="polite">
        {matchingFiles.length} {matchingFiles.length === 1 ? "résultat" : "résultats"}
      </p>
      {matchingFiles.length === 0 ? (
        <p className="mt-4">Aucun résultat.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {matchingFiles.map((file) => (
            <li
              key={file.id}
              className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-4"
            >
              <h2 className="font-semibold">{file.title}</h2>
              <p>{file.status === "published" ? "Publié" : "Brouillon"}</p>
              <p>{file.programName + ", " + file.levelName + ", " + file.academicYearLabel + ", " + file.subjectName}</p>
              <p>{new Date(file.createdAt).toLocaleDateString("fr-FR")}</p>
              <DeleteControl
                action={deleteAction}
                universityId={universityId}
                fields={{ id: file.id }}
                itemName={file.title}
                label={deleteLabel}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
