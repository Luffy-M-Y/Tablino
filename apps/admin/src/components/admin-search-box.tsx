"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { loadAdminSearchIndexAction, type AdminSearchIndex } from "@/app/admin-search/actions";
import { searchAdminCatalog } from "@/lib/admin-search.mjs";

const headerFocusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const panelFocusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

type IndexState =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; index: AdminSearchIndex };

export default function AdminSearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [indexState, setIndexState] = useState<IndexState>({ status: "idle" });
  const loadCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Filtrage local, sans appel au serveur à chaque frappe.
  const search = useMemo(() => {
    if (indexState.status !== "ready" || indexState.index === null) return { results: [], truncated: false };
    return searchAdminCatalog(indexState.index.data, query, indexState.index.universityId);
  }, [indexState, query]);
  const results = search.results;
  const truncated = search.truncated;
  const searched = indexState.status === "ready" && query.trim().length >= 2;

  // Index rechargé à chaque ouverture : il reste à jour.
  function loadIndex() {
    loadCounter.current += 1;
    const current = loadCounter.current;
    setIndexState({ status: "loading" });
    loadAdminSearchIndexAction().then(
      (index) => {
        if (current === loadCounter.current) setIndexState({ status: "ready", index });
      },
      () => {
        if (current === loadCounter.current) setIndexState({ status: "error" });
      },
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Rechercher"
        aria-expanded={open}
        aria-controls="admin-search-panel"
        className={"flex items-center justify-center rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white " + headerFocusStyle}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            loadIndex();
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      </button>
      {open && (
        <div
          id="admin-search-panel"
          role="search"
          className="fixed inset-x-2 top-16 z-50 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_24px_60px_-24px_rgb(15_42_94/45%)] sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-3 sm:w-[min(36rem,calc(100vw-22rem))]"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              buttonRef.current?.focus();
            }
          }}
        >
          <label htmlFor="admin-search-input" className="sr-only">Rechercher dans l’administration</label>
          <input
            ref={inputRef}
            id="admin-search-input"
            type="search"
            value={query}
            maxLength={100}
            autoComplete="off"
            placeholder="Rechercher une filière, un cours ou un devoir"
            className="h-11 w-full rounded-xl border border-slate-400 px-4 text-sm focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/15"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <div aria-live="polite" className="mt-3 max-h-[70vh] overflow-y-auto">
            {indexState.status === "loading" ? (
              <p className="text-sm text-slate-600">Préparation de la recherche…</p>
            ) : indexState.status === "error" ? (
              <p role="alert" className="text-sm text-red-700">Recherche indisponible. Ferme puis rouvre la recherche.</p>
            ) : searched && results.length === 0 ? (
              <p className="text-sm text-slate-600">Aucun résultat</p>
            ) : (
              <ul className="space-y-1">
                {results.map((result, index) => (
                  <li key={result.href + "_" + String(index)}>
                    <Link
                      href={result.href}
                      className={"flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 " + panelFocusStyle}
                      onClick={() => setOpen(false)}
                    >
                      <span>{result.segments.join(" / ")}</span>
                      {result.status === "draft" && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          Brouillon
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {truncated && <p className="mt-2 text-xs text-slate-600">Résultats limités à 50</p>}
          </div>
        </div>
      )}
    </div>
  );
}
