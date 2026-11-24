"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { AdminCard, adminDangerButtonClass, adminLabelClass, adminPrimaryButtonClass } from "@/components/admin-ui";
import { removeLogoAction, uploadLogoAction, type LogoState } from "./actions";

const initialState: LogoState = { status: "idle", message: null };
const MAX_BYTES = 2 * 1024 * 1024;

export function LogoForm({ universityName, logoUrl }: { universityName: string; logoUrl: string | null }) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadLogoAction, initialState);
  const [removeState, removeAction, removing] = useActionState(removeLogoAction, initialState);
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"upload" | "remove">("upload");

  // Libère l'aperçu local quand il change ou quand le composant disparaît.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const state = lastAction === "remove" ? removeState : uploadState;
  const shown = preview ?? logoUrl;

  return (
    <AdminCard className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-page-background)]">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou image de l'hôte admin
            <img src={shown} alt={`Logo de ${universityName}`} className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-sm text-[color:var(--color-muted-foreground)]">Aucun logo</span>
          )}
        </div>
        <div className="space-y-2 text-sm text-[color:var(--color-muted-foreground)]">
          <p>
            Le logo s&apos;affiche dans la recherche des universit&eacute;s et sur le bouton de votre compte. Sans logo,
            l&apos;acronyme s&apos;affiche.
          </p>
          <p>PNG, JPEG ou WebP, 2 Mo au plus. L&apos;image est recadr&eacute;e en carr&eacute; de 256 pixels.</p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setLastAction("upload");
          startTransition(() => uploadAction(formData));
        }}
        className="space-y-3"
      >
        <label htmlFor="logo" className={adminLabelClass}>Nouveau logo</label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            setClientError(null);
            if (!file) {
              setPreview(null);
              return;
            }
            if (file.size > MAX_BYTES) {
              setClientError("Image trop lourde : 2 Mo au plus.");
              event.target.value = "";
              setPreview(null);
              return;
            }
            setPreview(URL.createObjectURL(file));
          }}
          className="block w-full text-sm file:mr-4 file:min-h-11 file:cursor-pointer file:rounded-[var(--radius-rounded)] file:border-0 file:bg-[color:var(--color-page-background)] file:px-4 file:font-semibold file:text-[color:var(--color-text)]"
        />
        <button type="submit" disabled={uploading || removing || clientError !== null} className={`gap-2 ${adminPrimaryButtonClass}`}>
          <ImageUp size={16} aria-hidden="true" />
          {uploading ? "Enregistrement…" : "Enregistrer le logo"}
        </button>
      </form>

      {logoUrl ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            setLastAction("remove");
            startTransition(() => removeAction(formData));
          }}
        >
          <button type="submit" disabled={uploading || removing} className={`gap-2 ${adminDangerButtonClass}`}>
            <Trash2 size={16} aria-hidden="true" />
            {removing ? "Suppression…" : "Retirer le logo"}
          </button>
        </form>
      ) : null}

      {clientError ? (
        <p role="alert" className="text-sm font-medium text-red-700">{clientError}</p>
      ) : state.message ? (
        <p role={state.status === "error" ? "alert" : "status"} className={`text-sm font-medium ${state.status === "error" ? "text-red-700" : "text-green-800"}`}>
          {state.message}
        </p>
      ) : null}
    </AdminCard>
  );
}
