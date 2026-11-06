"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { adminSearchAction } from "@/app/admin-search/actions";
import type { AdminSearchResult } from "@/lib/admin-search.mjs";

const headerFocusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const panelFocusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

export default function AdminSearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function run(nextQuery: string) {
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
        const response = await adminSearchAction(nextQuery);
        if (current === counter.current) {
          setResults(response.results);
          setTruncated(response.truncated);
          setSearched(true);
        }
      });
    }, 300);
  }

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  return (
    <>
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
          className="absolute left-0 right-0 top-full z-50 border-t border-slate-200 bg-white p-4 text-slate-900 shadow-md"
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
            className={"w-full rounded-lg border border-slate-300 px-3 py-2 text-sm " + panelFocusStyle}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              run(nextQuery);
            }}
          />
          <div aria-live="polite" className="mt-3 max-h-[70vh] overflow-y-auto">
            {isPending ? (
              <p className="text-sm text-slate-600">Recherche…</p>
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
    </>
  );
}
