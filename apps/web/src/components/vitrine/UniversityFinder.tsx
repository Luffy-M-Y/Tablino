"use client";

import { ArrowUpRight, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { focusRing } from "@/components/ui/kit";
import { UNIVERSITY_FINDER_INPUT_ID } from "@/components/vitrine/FindUniversityLink";
import { filterUniversities, UNIVERSITY_FINDER_MAX_QUERY_LENGTH } from "@/lib/university-finder.mjs";

export type FinderEntry = {
  name: string;
  acronym: string;
  locality: string | null;
  url: string;
};

// Recherche instantanée : filtre côté navigateur la liste publique des
// universités actives, sans appel au serveur.
export function UniversityFinder({
  universities,
  inputId = UNIVERSITY_FINDER_INPUT_ID,
  linkHint = "accéder à l’espace étudiant",
}: {
  universities: FinderEntry[];
  inputId?: string;
  linkHint?: string;
}) {
  const [query, setQuery] = useState("");
  const statusId = useId();
  const results = useMemo(() => filterUniversities(universities, query), [universities, query]);
  const hasQuery = query.trim().length > 0;

  let status = "";
  if (hasQuery) {
    status = results.length === 0
      ? "Aucune université active ne correspond."
      : `${results.length} université${results.length > 1 ? "s" : ""} trouvée${results.length > 1 ? "s" : ""}.`;
  }

  return (
    <div className="space-y-4">
      <label htmlFor={inputId} className="block text-sm font-semibold text-[color:var(--color-foreground)]">
        Nom ou acronyme de votre universit&eacute;
      </label>
      <div className="relative">
        <Search
          size={20}
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-foreground)]"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={UNIVERSITY_FINDER_MAX_QUERY_LENGTH}
          autoComplete="off"
          spellCheck={false}
          placeholder="Exemple : ISCOM"
          aria-describedby={statusId}
          className={`h-14 w-full scroll-mt-28 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white pl-12 pr-4 text-base text-[color:var(--color-foreground)] transition-shadow duration-200 focus:shadow-[0_0_0_4px_rgb(37_99_235/15%)] motion-reduce:transition-none ${focusRing}`}
        />
      </div>
      <p id={statusId} role="status" className="min-h-5 text-sm text-[color:var(--color-muted-foreground)]">
        {status}
      </p>
      {results.length > 0 && (
        <ul className="space-y-2" aria-label="Universités trouvées">
          {results.map((university, index) => (
            <li
              key={university.url}
              className="vt-result"
              style={{ ["--vt-i" as string]: index }}
            >
              <a
                href={university.url}
                className={`group flex items-center gap-4 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--color-primary)] hover:bg-white hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${focusRing}`}
              >
                <span className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-rounded)] bg-[color:var(--color-brand)] px-2 text-xs font-bold text-white">
                  {university.acronym}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-[color:var(--color-foreground)]">{university.name}</span>
                  <span className="block text-sm text-[color:var(--color-muted-foreground)]">
                    {university.locality ? `${university.acronym}, ${university.locality}` : university.acronym}
                    <span className="sr-only"> : {linkHint}</span>
                  </span>
                </span>
                <ArrowUpRight
                  size={20}
                  aria-hidden="true"
                  className="shrink-0 text-[color:var(--color-primary)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
