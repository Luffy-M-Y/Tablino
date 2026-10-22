"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { normalizeSearchValue } from "@/lib/search-normalization.mjs";

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
          className="w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2"
        />
        <button
          type="button"
          onClick={() => setQuery("")}
          className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
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
            <Link
              key={program.id}
              href={`/structure/${universityId}/programs/${program.id}`}
              className="flex flex-col gap-2 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]"
            >
              <h2 className="text-xl font-semibold">{program.name}</h2>
              <span className={statusClassName(program.status)}>{statusLabel(program.status)}</span>
              <p>{countLabel(program.cyclesCount, "cycle", "cycles")}</p>
              <p>{countLabel(program.subjectsCount, "matière", "matières")}</p>
              <span>Ouvrir</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
