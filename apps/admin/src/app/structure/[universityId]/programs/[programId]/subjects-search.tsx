"use client";

import { useMemo, useState } from "react";

type Subject = {
  id: string;
  name: string;
};

type Props = {
  subjects: Subject[];
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

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
      <input
        id="subject-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-2 w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2"
      />
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
