"use client";

import { useMemo, useState } from "react";
import { normalizeSearchValue } from "@/lib/search-normalization.mjs";

type Subject = {
  id: string;
  name: string;
};

type Props = {
  subjects: Subject[];
};

export function SubjectsSearch({ subjects }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchValue(query);
  const matchingSubjects = useMemo(
    () => subjects.filter((subject) => normalizeSearchValue(subject.name).includes(normalizedQuery)),
    [normalizedQuery, subjects],
  );

  if (subjects.length === 0) {
    return <p>Aucune matière.</p>;
  }

  return (
    <div>
      <label htmlFor="subject-search">Rechercher une matière</label>
      <div className="mt-2 flex gap-3">
        <input
          id="subject-search"
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
        {matchingSubjects.length} {matchingSubjects.length === 1 ? "résultat" : "résultats"}
      </p>
      {matchingSubjects.length === 0 ? (
        <p className="mt-4">Aucune matière trouvée.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {matchingSubjects.map((subject) => (
            <li key={subject.id} className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)]">
              {subject.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
