"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { loadSearchIndexAction } from "@/app/recherche/actions";
import type { SearchCatalog } from "@tablino/db";
import { searchCatalog } from "@tablino/db/search-catalog";

type Scope = "all" | "program" | "subject";
type IndexState =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; catalog: SearchCatalog };

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [index, setIndex] = useState<IndexState>({ status: "idle" });
  const loadCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Filtrage local, sans appel au serveur à chaque frappe.
  const search = useMemo(
    () => (index.status === "ready" ? searchCatalog(index.catalog, query, scope) : { results: [], truncated: false }),
    [index, query, scope],
  );
  const results = search.results;
  const truncated = search.truncated;
  const searched = index.status === "ready" && query.trim().length >= 2;

  // Index rechargé à chaque ouverture : il reste à jour.
  function loadIndex() {
    loadCounter.current += 1;
    const current = loadCounter.current;
    setIndex({ status: "loading" });
    loadSearchIndexAction().then(
      (catalog) => {
        if (current === loadCounter.current) setIndex({ status: "ready", catalog });
      },
      () => {
        if (current === loadCounter.current) setIndex({ status: "error" });
      },
    );
  }

  useEffect(function () {
    if (!open) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target === null) {
        return;
      }
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return function () {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Rechercher"
        aria-expanded={open}
        aria-controls="search-panel"
        className="flex items-center justify-center rounded-lg p-2 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-background)] hover:text-[color:var(--color-primary-text)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring)]"
        onClick={function () {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            loadIndex();
            setTimeout(function () {
              inputRef.current?.focus();
            }, 0);
          }
        }}
      >
        <Search size={16} aria-hidden="true" />
      </button>

      {open ? (
        <div
          id="search-panel"
          ref={panelRef}
          role="search"
          className="absolute top-full left-0 right-0 z-50 border-t border-[color:var(--color-border)] bg-white p-3 shadow-md"
          onKeyDown={function (event) {
            if (event.key === "Escape") {
              setOpen(false);
              buttonRef.current?.focus();
            }
          }}
        >
          <div className="flex items-center gap-2">
            <label htmlFor="search-input" className="sr-only">
              Rechercher dans les cours, devoirs, fili&egrave;res et mati&egrave;res
            </label>
            <input
              id="search-input"
              ref={inputRef}
              type="search"
              autoComplete="off"
              maxLength={100}
              value={query}
              placeholder="Rechercher…"
              className="w-full rounded-lg border border-[color:var(--color-input-border)] bg-white px-3 py-2 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring)]"
              onChange={function (event) {
                const nextValue = event.target.value;
                setQuery(nextValue);
              }}
            />
            <button
              type="button"
              className="flex items-center justify-center rounded-lg p-2 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-background)] hover:text-[color:var(--color-primary-text)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring)]"
              aria-label="Fermer la recherche"
              onClick={function () {
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div role="group" aria-label="Filtrer la recherche" className="mt-3 flex gap-2">
            {[
              { value: "all", label: "Tout" },
              { value: "program", label: "Fili\u00e8re" },
              { value: "subject", label: "Mati\u00e8re" },
            ].map(function (item) {
              const active = scope === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  className={
                    active
                      ? "rounded-lg bg-[color:var(--color-background)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-foreground)]"
                      : "rounded-lg px-3 py-1.5 text-xs font-medium text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-background)] hover:text-[color:var(--color-primary-text)]"
                  }
                  onClick={function () {
                    const nextScope = item.value as Scope;
                    setScope(nextScope);
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div aria-live="polite" className="mt-3 max-h-[70vh] overflow-y-auto">
            {index.status === "loading" ? (
              <p className="text-sm text-[color:var(--color-muted-foreground)]">Pr&eacute;paration de la recherche…</p>
            ) : index.status === "error" ? (
              <p role="alert" className="text-sm text-[color:var(--color-destructive-text)]">Recherche indisponible. Ferme puis rouvre la recherche.</p>
            ) : searched && results.length === 0 ? (
              <p className="text-sm text-[color:var(--color-muted-foreground)]">Aucun r&eacute;sultat.</p>
            ) : (
              <ul className="space-y-1">
                {results.map(function (result, index) {
                  return (
                    <li key={result.href + "_" + String(index)}>
                      <Link
                        href={result.href}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-background)] hover:text-[color:var(--color-primary-text)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring)]"
                        onClick={function () {
                          setOpen(false);
                        }}
                      >
                        <span className="font-medium text-[color:var(--color-foreground)]">{result.segments[0]}</span>
                        <span className="text-[color:var(--color-muted-foreground)]">{result.segments.slice(1).join(" / ")}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {truncated ? (
              <p className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">R&eacute;sultats limit&eacute;s aux 50 premiers. Pr&eacute;cise ta recherche.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
