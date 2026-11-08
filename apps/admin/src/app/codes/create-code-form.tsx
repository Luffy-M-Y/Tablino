"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AdminCard,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin-ui";
import { createCodeAction, type CreateCodeState } from "./actions";

export function CreateCodeForm() {
  const [result, setResult] = useState<CreateCodeState | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isModalOpen = result !== null && result.code !== null && result.expiresAt !== null;

  useEffect(() => {
    if (!isModalOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setResult(null);
        setCopyStatus(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  function closeModal() {
    setResult(null);
    setCopyStatus(null);
  }

  async function copyCode() {
    if (!result?.code) return;

    try {
      await navigator.clipboard.writeText(result.code);
      setCopyStatus("Copié.");
    } catch {
      setCopyStatus("Copie impossible. Sélectionne le code à la main.");
    }
  }

  return (
    <AdminCard className="!p-4">
      <form
        action={(formData) => {
          startTransition(async () => {
            const next = await createCodeAction(
              { message: null, code: null, expiresAt: null },
              formData,
            );
            setResult(next);
          });
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4"
      >
        <div className="min-w-0">
          <label htmlFor="maxUses" className="mb-1.5 block whitespace-nowrap text-sm font-medium text-[color:var(--color-text)]">
            Nombre d'utilisations maximum
          </label>
          <div className="w-28 shrink-0">
            <input
              id="maxUses"
              name="maxUses"
              type="number"
              defaultValue={1}
              min={1}
              max={5000}
              required
              className={`${adminFieldClass} h-10 w-full py-0 pr-2`}
            />
          </div>
          <p className="mt-1.5 max-w-xs text-xs text-[color:var(--color-muted-foreground)]">
            Combien d'étudiants peuvent utiliser ce code
          </p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className={`${adminPrimaryButtonClass} w-full sm:w-auto`}
        >
          Générer un code
        </button>
      </form>
      {result?.message && <p role="alert" className="mt-4 text-red-700">{result.message}</p>}
      {result && result.code && result.expiresAt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <AdminCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="generated-code-title"
            className="w-full max-w-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="generated-code-title" className="mb-4 text-xl font-semibold text-[color:var(--color-text)]">
              Code d'accès généré
            </h2>
            <p className="select-all break-all font-mono text-lg font-semibold">{result.code}</p>
            <p className="mt-2">Ce code ne sera plus affiché. Copie-le maintenant.</p>
            <p className="mt-1 text-sm text-slate-600">
              Expire le {new Date(result.expiresAt).toLocaleString("fr-FR")}
            </p>
            {copyStatus && <p role="status" className="mt-3 text-sm text-[color:var(--color-text)]">{copyStatus}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={copyCode}
                className={adminSecondaryButtonClass}
              >
                Copier
              </button>
              <button
                type="button"
                onClick={closeModal}
                className={adminPrimaryButtonClass}
              >
                Fermer
              </button>
            </div>
          </AdminCard>
        </div>
      )}
    </AdminCard>
  );
}
