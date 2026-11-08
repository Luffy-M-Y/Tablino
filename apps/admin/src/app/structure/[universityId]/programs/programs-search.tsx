"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AdminCard,
  adminFieldClass,
  adminSecondaryButtonClass,
} from "@/components/admin-ui";
import { normalizeSearchValue } from "@/lib/search-normalization.mjs";
import { deleteProgramAction } from "../actions";
import { DeleteControl } from "../structure-edit-controls";

type Program = {
  id: string;
  name: string;
  status: "draft" | "published";
  cyclesCount: number;
  subjectsCount: number;
};

type Props = {
  universityId: string;
  programs: Program[];
};

function statusLabel(status: Program["status"]) {
  return status === "published" ? "Publiée" : "Brouillon";
}

function statusClassName(status: Program["status"]) {
  return status === "published"
    ? "self-start rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800"
    : "self-start rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700";
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ProgramsSearch({ universityId, programs }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchValue(query);
  const matchingPrograms = useMemo(
    () => programs.filter((program) => normalizeSearchValue(program.name).includes(normalizedQuery)),
    [normalizedQuery, programs],
  );

  if (programs.length === 0) {
    return <p>Aucune filière.</p>;
  }

  return (
    <div>
      <label htmlFor="program-search">Rechercher une filière</label>
      <div className="mt-2 flex gap-3">
        <input
          id="program-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          className={adminFieldClass}
        />
        <button
          type="button"
          onClick={() => setQuery("")}
          className={adminSecondaryButtonClass}
        >
          Effacer
        </button>
      </div>
      <p className="mt-3" aria-live="polite">
        {matchingPrograms.length} {matchingPrograms.length === 1 ? "résultat" : "résultats"}
      </p>
      {matchingPrograms.length === 0 ? (
        <p className="mt-4">Aucune filière trouvée.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {matchingPrograms.map((program) => (
            <AdminCard
              key={program.id}
              className="group relative flex flex-col gap-2 motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[var(--admin-card-shadow-hover)] motion-safe:focus-within:-translate-y-1 motion-safe:focus-within:shadow-[var(--admin-card-shadow-hover)] motion-reduce:transition-colors hover:border-[color:var(--color-primary)] focus-within:border-[color:var(--color-primary)]"
            >
              <Link
                href={`/structure/${universityId}/programs/${program.id}`}
                className="flex flex-col gap-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
              >
                <h2 className="text-xl font-semibold">{program.name}</h2>
                <span className={statusClassName(program.status)}>{statusLabel(program.status)}</span>
                <p>{countLabel(program.cyclesCount, "cycle", "cycles")}</p>
                <p>{countLabel(program.subjectsCount, "matière", "matières")}</p>
                <span>Ouvrir</span>
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href={`/structure/${universityId}/programs/${program.id}/edit`}
                  aria-label="Modifier la filière"
                  className={`${adminSecondaryButtonClass} size-10 p-2`}
                >
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
                    <path d="m16 5 3 3M4 20l4.5-1 10-10a2.12 2.12 0 0 0-3-3l-10 10L4 20Z" />
                  </svg>
                </Link>
                <DeleteControl
                  action={deleteProgramAction}
                  universityId={universityId}
                  fields={{ programId: program.id }}
                  itemName={program.name}
                  label="Supprimer la filière"
                />
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </div>
  );
}
