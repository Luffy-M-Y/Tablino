"use client";

import { useId, useMemo, useState } from "react";
import { filterFiles, type FileFilterStatus } from "@/lib/files-filter.mjs";
import { FileText, Search, X } from "lucide-react";
import { AdminCard, adminFieldClass } from "@/components/admin-ui";
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
  const statusOptions: { value: FileFilterStatus; label: string }[] = [
    { value: "all", label: "Tous" },
    { value: "published", label: "Publiés" },
    { value: "draft", label: "Brouillons" },
  ];
  const matchingFiles = useMemo(
    () => filterFiles(files, query, status),
    [files, query, status],
  );
  const deleteAction = kind === "resource" ? deleteResourceAction : deleteAssignmentAction;
  const deleteLabel = kind === "resource" ? "Supprimer le cours" : "Supprimer le devoir";
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="w-full md:max-w-sm">
          <label htmlFor={inputId} className="sr-only">Rechercher</label>
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
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
              placeholder="Rechercher…"
              className={`${adminFieldClass} h-10 py-0 pl-10 ${query ? "pr-10" : ""}`}
            />
            {query ? (
              <button
                type="button"
                onClick={clearFilters}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-page-background)] hover:text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--color-ring)]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <fieldset className="min-w-0">
          <legend className="sr-only">Statut</legend>
          <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-page-background)] p-1 md:w-auto">
            {statusOptions.map((option) => {
              const optionId = `${inputId}-status-${option.value}`;
              return (
                <label key={option.value} htmlFor={optionId} className="cursor-pointer">
                  <input
                    id={optionId}
                    type="radio"
                    name={`${inputId}-status`}
                    value={option.value}
                    checked={status === option.value}
                    onChange={() => setStatus(option.value)}
                    className="peer sr-only"
                  />
                  <span className="flex h-10 items-center justify-center rounded-lg px-2 text-sm font-semibold text-[color:var(--color-text)] transition-[color,background-color,box-shadow] duration-200 hover:bg-white/70 hover:text-[color:var(--color-primary-text)] peer-checked:bg-[color:var(--color-primary)] peer-checked:text-white peer-checked:shadow-sm peer-checked:hover:bg-[color:var(--color-primary)] peer-checked:hover:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--color-ring)] motion-reduce:transition-none sm:px-3">
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
      <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]" aria-live="polite">
        {matchingFiles.length} {matchingFiles.length === 1 ? "résultat" : "résultats"}
      </p>
      {matchingFiles.length === 0 ? (
        <AdminCard className="mt-4 flex flex-col items-center py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[color:var(--admin-icon-background)] text-[color:var(--admin-icon-color)]">
            <FileText size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold text-[color:var(--color-text)]">
            {files.length === 0
              ? kind === "resource" ? "Aucun cours pour le moment" : "Aucun devoir pour le moment"
              : "Aucun résultat pour cette recherche"}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            {files.length === 0
              ? "Les fichiers gérés par cette université apparaîtront ici."
              : "Essaie un autre terme ou modifie le filtre de statut."}
          </p>
        </AdminCard>
      ) : (
        <ul className="mt-4 space-y-3">
          {matchingFiles.map((file) => (
            <li key={file.id}>
              <AdminCard className="group p-4 hover:border-[color:var(--color-primary)] focus-within:border-[color:var(--color-primary)] motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--admin-card-shadow-hover)] motion-safe:focus-within:-translate-y-0.5 motion-safe:focus-within:shadow-[var(--admin-card-shadow-hover)] motion-reduce:transition-colors">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--admin-icon-background)] text-[color:var(--admin-icon-color)]">
                      <FileText size={21} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="break-words font-semibold text-[color:var(--color-text)]">{file.title}</h2>
                      <p className="mt-1 break-words text-sm text-[color:var(--color-muted-foreground)]">
                        {[
                          file.programName,
                          file.levelName,
                          file.academicYearLabel,
                          file.subjectName,
                          new Date(file.createdAt).toLocaleDateString("fr-FR"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:ml-auto sm:justify-end">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        file.status === "published"
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-orange-200 bg-orange-50 text-orange-900"
                      }`}
                    >
                      {file.status === "published" ? "Publié" : "Brouillon"}
                    </span>
                    <DeleteControl
                      action={deleteAction}
                      universityId={universityId}
                      fields={{ id: file.id }}
                      itemName={file.title}
                      label={deleteLabel}
                    />
                  </div>
                </div>
              </AdminCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
