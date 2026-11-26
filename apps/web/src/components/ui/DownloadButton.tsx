"use client";

import { useRef, useState, type MouseEvent } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { buildDownloadFileName, downloadProgressPercent } from "@/lib/file-download.mjs";
import { primaryButtonClass } from "@/components/ui/kit";

type Props = {
  /** Route de téléchargement contrôlée (« /fichiers/<id> »). */
  href: string;
  /** Titre affiché, sert aussi au nom du fichier enregistré. */
  title: string;
};

/** Au-delà, le fichier n'est pas lu en mémoire (téléphones). */
const MAX_IN_MEMORY_BYTES = 150 * 1024 * 1024;

type DownloadState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "loading"; percent: number | null }
  | { status: "done" };

/**
 * Téléchargement avec progression : la page lit le fichier en flux depuis le lien signé.
 * En cas d'échec (règle CORS absente, réseau), retour au lien classique, sans progression.
 */
export function DownloadButton({ href, title }: Props) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });
  const busyRef = useRef(false);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Ctrl, Maj, clic du milieu : comportement normal du navigateur.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    // Attente du lien signé (contrôles d'accès), puis lecture du fichier.
    setState({ status: "preparing" });

    try {
      const linkResponse = await fetch(`${href}?format=json`, { cache: "no-store", credentials: "same-origin" });
      if (!linkResponse.ok) throw new Error("link_unavailable");
      const link: unknown = await linkResponse.json();
      if (typeof link !== "object" || link === null) throw new Error("invalid_link");
      const { url, extension } = link as { url?: unknown; extension?: unknown };
      if (typeof url !== "string" || !url.startsWith("https://")) throw new Error("invalid_link");

      const fileResponse = await fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
      if (!fileResponse.ok || !fileResponse.body) throw new Error("file_unavailable");

      const total = Number(fileResponse.headers.get("Content-Length"));
      setState({ status: "loading", percent: downloadProgressPercent(0, total) });
      if (total > MAX_IN_MEMORY_BYTES) {
        // Gros fichier (vidéo) : pas de lecture en mémoire, le navigateur télécharge lui-même.
        await fileResponse.body.cancel();
        setState({ status: "idle" });
        window.location.assign(url);
        return;
      }
      const reader = fileResponse.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        setState({ status: "loading", percent: downloadProgressPercent(received, total) });
      }

      const blob = new Blob(chunks as BlobPart[], { type: fileResponse.headers.get("Content-Type") ?? "" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = buildDownloadFileName(title, extension);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setState({ status: "done" });
    } catch {
      // Lien classique : la route contrôle de nouveau l'accès et redirige vers R2.
      setState({ status: "idle" });
      window.location.assign(href);
    } finally {
      busyRef.current = false;
    }
  }

  const preparing = state.status === "preparing";
  const loading = preparing || state.status === "loading";
  const percent = state.status === "loading" ? state.percent : null;

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-busy={loading}
      aria-label={loading ? undefined : `Télécharger ${title}`}
      className={`${primaryButtonClass} relative !w-auto inline-flex shrink-0 items-center justify-center gap-1.5 overflow-hidden`}
    >
      {loading ? (
        <>
          <LoaderCircle size={15} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />
          <span>
            {preparing ? "Préparation…" : "Téléchargement…"}
            {percent !== null ? <span className="ml-1 tabular-nums">{percent} %</span> : null}
          </span>
          {percent !== null ? (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1 bg-white/30"
            >
              <span className="block h-full bg-white transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
            </span>
          ) : null}
        </>
      ) : (
        <>
          <Download size={15} aria-hidden="true" />
          Télécharger
        </>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {loading ? "Téléchargement en cours" : state.status === "done" ? "Téléchargement terminé" : ""}
      </span>
    </a>
  );
}
