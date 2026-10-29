"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { searchAction } from "@/app/recherche/actions";
import type { SearchResult } from "@tablino/db";

type Scope = "all" | "program" | "subject";

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function run(nextQuery: string, nextScope: Scope) {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    counter.current += 1;
    if (nextQuery.trim().length < 2) {
      setResults([]);
      setTruncated(false);
      setSearched(false);
      return;
    }

    const current = counter.current;
    timer.current = setTimeout(function () {
      startTransition(async function () {
        const response = await searchAction(nextQuery, nextScope);
        if (current === counter.current) {
          setResults(response.results);
          setTruncated(response.truncated);
          setSearched(true);
        }
      });
    }, 300);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Rechercher"
        aria-expanded={open}
        aria-controls="search-panel"
        className="flex items-center justify-center rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        onClick={function () {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
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
          role="search"
          className="absolute top-full left-0 right-0 z-50 border-t border-white/10 bg-uni-900 p-3 shadow-md"
          onKeyDown={function (event) {
            if (event.key === "Escape") {
              setOpen(false);
              buttonRef.current?.focus();
            }
          }}
        >
          <div className="flex items-center gap-2">
            <label htmlFor="search-input" className="sr-only">
              Rechercher dans les cours, devoirs, filières et matières
            </label>
            <input
              id="search-input"
              ref={inputRef}
              type="search"
              autoComplete="off"
              maxLength={100}
              value={query}
              placeholder="Rechercher…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 focus-visible:outline-2 focus-visible:outline-white"
              onChange={function (event) {
                const nextValue = event.target.value;
                setQuery(nextValue);
                run(nextValue, scope);
              }}
            />
            <button
              type="button"
              className="flex items-center justify-center rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
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
              { value: "program", label: "Filière" },
              { value: "subject", label: "Matière" },
            ].map(function (item) {
              const active = scope === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  className={
                    active
                      ? "rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white"
                      : "rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
                  }
                  onClick={function () {
                    const nextScope = item.value as Scope;
                    setScope(nextScope);
                    run(query, nextScope);
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div aria-live="polite" className="mt-3 max-h-[70vh] overflow-y-auto">
            {isPending ? (
              <p className="text-sm text-white/80">Recherche…</p>
            ) : searched && results.length === 0 ? (
              <p className="text-sm text-white/80">Aucun résultat.</p>
            ) : (
              <ul className="space-y-1">
                {results.map(function (result, index) {
                  return (
                    <li key={result.href + "_" + String(index)}>
                      <Link
                        href={result.href}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                        onClick={function () {
                          setOpen(false);
                        }}
                      >
                        <span className="font-medium text-white">{result.segments[0]}</span>
                        <span className="text-white/80">{result.segments.slice(1).join(" / ")}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {truncated ? (
              <p className="mt-2 text-xs text-white/70">Résultats limités aux 50 premiers. Précise ta recherche.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
