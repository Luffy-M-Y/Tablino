"use client";

import { useEffect, useState, useTransition } from "react";
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
    <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
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
        className="space-y-4"
      >
        <div>
          <label htmlFor="maxUses" className="mb-2 block">
            Nombre d'utilisations maximum
          </label>
          <input
            id="maxUses"
            name="maxUses"
            type="number"
            min={1}
            max={5000}
            required
            className="rounded border border-[color:var(--color-border)] px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-2 font-semibold text-white disabled:opacity-60"
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generated-code-title"
            className="w-full max-w-lg rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]"
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
                className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-4 py-2 font-semibold text-[color:var(--color-text)]"
              >
                Copier
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-2 font-semibold text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
