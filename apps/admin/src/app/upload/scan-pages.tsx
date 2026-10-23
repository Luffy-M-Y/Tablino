"use client";

import { useEffect, useRef, useState } from "react";

type ScanPage = {
  id: number;
  file: File;
  url: string;
};

const MAX_PAGES = 20;

export function ScanPages() {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [ignoredFiles, setIgnoredFiles] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const pagesRef = useRef<ScanPage[]>([]);

  function replacePages(nextPages: ScanPage[]) {
    pagesRef.current = nextPages;
    setPages(nextPages);
  }

  function handleCameraFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    setIgnoredFiles(false);

    if (!file || pagesRef.current.length >= MAX_PAGES) return;

    const page = {
      id: nextId.current,
      file,
      url: URL.createObjectURL(file),
    };
    nextId.current += 1;
    replacePages([...pagesRef.current, page]);
  }

  function handleGalleryFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    setIgnoredFiles(false);

    const nextPages = [...pagesRef.current];
    let skippedFiles = false;
    for (const file of files) {
      if (nextPages.length >= MAX_PAGES) {
        skippedFiles = true;
        continue;
      }

      nextPages.push({
        id: nextId.current,
        file,
        url: URL.createObjectURL(file),
      });
      nextId.current += 1;
    }

    if (nextPages.length !== pagesRef.current.length) replacePages(nextPages);
    setIgnoredFiles(skippedFiles);
  }

  function movePage(id: number, direction: -1 | 1) {
    const currentPages = pagesRef.current;
    const index = currentPages.findIndex((page) => page.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= currentPages.length) return;

    const nextPages = [...currentPages];
    [nextPages[index], nextPages[targetIndex]] = [nextPages[targetIndex], nextPages[index]];
    replacePages(nextPages);
  }

  function removePage(id: number) {
    const page = pagesRef.current.find((item) => item.id === id);
    if (!page) return;

    URL.revokeObjectURL(page.url);
    replacePages(pagesRef.current.filter((item) => item.id !== id));
  }

  useEffect(() => () => {
    pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    pagesRef.current = [];
  }, []);

  return (
    <section aria-label="Capture de pages" className="space-y-3">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleCameraFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleGalleryFilesChange}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={pages.length >= MAX_PAGES}
          className="min-h-[44px] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Prendre une photo
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={pages.length >= MAX_PAGES}
          className="min-h-[44px] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Choisir des images
        </button>
      </div>
      {pages.length >= MAX_PAGES && (
        <p>
          {ignoredFiles
            ? "Maximum 20 pages. Certaines images ont été ignorées."
            : "Maximum 20 pages."}
        </p>
      )}
      <p aria-live="polite">
        {pages.length} {pages.length === 1 ? "page" : "pages"}
      </p>
      <ol className="space-y-3">
        {pages.map((page, index) => {
          const pageNumber = index + 1;

          return (
            <li
              key={page.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-3"
            >
              <img
                src={page.url}
                alt={"Page " + pageNumber}
                className="max-h-24 max-w-24 object-cover"
              />
              <span>Page {pageNumber}</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-label={"Monter la page " + pageNumber}
                  onClick={() => movePage(page.id, -1)}
                  disabled={index === 0}
                  className="min-h-[44px] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Monter
                </button>
                <button
                  type="button"
                  aria-label={"Descendre la page " + pageNumber}
                  onClick={() => movePage(page.id, 1)}
                  disabled={index === pages.length - 1}
                  className="min-h-[44px] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Descendre
                </button>
                <button
                  type="button"
                  aria-label={"Supprimer la page " + pageNumber}
                  onClick={() => removePage(page.id)}
                  className="min-h-[44px] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3"
                >
                  Supprimer
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
