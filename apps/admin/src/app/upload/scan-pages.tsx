"use client";

import { useEffect, useRef, useState } from "react";
import { buildPdfFromImages } from "./build-pdf-from-images";
import { buildScanFileName } from "@/lib/scan-pages.mjs";

type ScanPage = {
  id: number;
  file: File;
  url: string;
};

const MAX_PAGES = 20;

export function ScanPages({ onPdfChange }: { onPdfChange?: (file: File | null) => void }) {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [ignoredFiles, setIgnoredFiles] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const pagesRef = useRef<ScanPage[]>([]);
  const pdfUrlRef = useRef<string | null>(null);

  function replacePages(nextPages: ScanPage[]) {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
    setPdfFile(null);
    onPdfChange?.(null);
    setPdfUrl(null);
    setPdfError(null);
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

  async function handleBuildPdf() {
    if (isBuilding || pagesRef.current.length === 0) return;

    setIsBuilding(true);
    setPdfError(null);
    setProgressLabel("Préparation du moteur...");
    try {
      const bytes = await buildPdfFromImages(
        pagesRef.current.map((page) => page.file),
        (current, total) => {
          setProgressLabel(current === 0
            ? "Préparation du moteur..."
            : "Page " + current + " sur " + total + "...");
        },
      );
      const file = new File([new Uint8Array(bytes)], buildScanFileName(new Date()), { type: "application/pdf" });
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      const url = URL.createObjectURL(file);
      pdfUrlRef.current = url;
      setPdfFile(file);
      onPdfChange?.(file);
      setPdfUrl(url);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Création du PDF impossible.");
    } finally {
      setIsBuilding(false);
      setProgressLabel(null);
    }
  }

  useEffect(() => () => {
    pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pagesRef.current = [];
    pdfUrlRef.current = null;
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
      <button
        type="button"
        onClick={handleBuildPdf}
        disabled={pages.length === 0 || isBuilding}
        className="min-h-[44px] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBuilding ? "Création..." : "Créer le PDF"}
      </button>
      {isBuilding && progressLabel && <p aria-live="polite">{progressLabel}</p>}
      {pdfError && <p role="alert">{pdfError}</p>}
      {pdfFile && pdfUrl && (
        <>
          <p>
            {pdfFile.name} (
            {pdfFile.size >= 1048576
              ? (pdfFile.size / 1048576).toFixed(1) + " Mo"
              : Math.round(pdfFile.size / 1024) + " Ko"}
            )
          </p>
          <a href={pdfUrl} target="_blank" rel="noopener">
            Ouvrir le PDF
          </a>
        </>
      )}
    </section>
  );
}
