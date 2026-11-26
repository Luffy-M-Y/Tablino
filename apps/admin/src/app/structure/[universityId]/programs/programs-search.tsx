"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, GraduationCap, Layers, Pencil, Search } from "lucide-react";
import { AdminEmptyState, AdminSearchField, adminIconButtonClass } from "@/components/admin-ui";
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
    ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200"
    : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200";
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
    return <AdminEmptyState variant="inset" icon={GraduationCap} title="Aucune filière" description="Ajoutez une première filière pour structurer vos cours." />;
  }

  return (
    <div>
      <AdminSearchField
        id="program-search"
        label="Rechercher une filière"
        placeholder="Rechercher une filière…"
        value={query}
        onChange={setQuery}
        resultCount={matchingPrograms.length}
      />
      {matchingPrograms.length === 0 ? (
        <AdminEmptyState variant="inset" icon={Search} title="Aucune filière trouvée" description="Essayez un autre mot-clé." />
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {matchingPrograms.map((program) => (
            <li
              key={program.id}
              className="group flex flex-col rounded-[var(--radius-rounded)] border border-[color:var(--admin-card-border)] bg-[color:var(--admin-card-background)] shadow-[var(--admin-card-shadow)] transition-colors hover:border-[color:var(--color-primary)] focus-within:border-[color:var(--color-primary)] motion-safe:transition-[box-shadow,border-color] motion-safe:duration-200 motion-safe:hover:shadow-[var(--admin-card-shadow-hover)] motion-reduce:transition-none"
            >
              <Link
                href={`/structure/${universityId}/programs/${program.id}`}
                className="flex flex-1 items-start gap-3 rounded-t-[var(--radius-rounded)] p-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--admin-icon-background)] text-[color:var(--admin-icon-color)]">
                  <GraduationCap size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="line-clamp-2 font-semibold leading-snug text-[color:var(--color-text)]">{program.name}</h2>
                    <ArrowRight
                      size={18}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-[color:var(--admin-icon-color)] transition-transform duration-200 motion-safe:group-hover:translate-x-1 motion-reduce:transition-none"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[color:var(--color-muted-foreground)]">
                    <span className={statusClassName(program.status)}>{statusLabel(program.status)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Layers size={14} aria-hidden="true" />
                      {countLabel(program.cyclesCount, "cycle", "cycles")}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BookOpen size={14} aria-hidden="true" />
                      {countLabel(program.subjectsCount, "matière", "matières")}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="flex flex-wrap items-start justify-end gap-2 border-t border-[color:var(--admin-card-border)] px-4 py-2.5">
                <Link
                  href={`/structure/${universityId}/programs/${program.id}/edit`}
                  aria-label="Modifier la filière"
                  title="Modifier la filière"
                  className={adminIconButtonClass}
                >
                  <Pencil size={18} aria-hidden="true" />
                </Link>
                <DeleteControl
                  action={deleteProgramAction}
                  universityId={universityId}
                  fields={{ programId: program.id }}
                  itemName={program.name}
                  label="Supprimer la filière"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
