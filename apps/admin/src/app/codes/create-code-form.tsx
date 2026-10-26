"use client";

import { useActionState } from "react";
import { createCodeAction } from "./actions";

export function CreateCodeForm() {
  const [state, formAction, pending] = useActionState(createCodeAction, {
    message: null,
    code: null,
    expiresAt: null,
  });

  return (
    <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
      <form action={formAction} className="space-y-4">
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
      {state.message && <p role="alert" className="mt-4 text-red-700">{state.message}</p>}
      {state.code && state.expiresAt && (
        <div className="mt-4 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-slate-50 p-4">
          <p className="break-all font-mono text-lg font-semibold">{state.code}</p>
          <p className="mt-2">Ce code ne sera plus affiché. Copie-le maintenant.</p>
          <p className="mt-1 text-sm text-slate-600">
            Expire le {new Date(state.expiresAt).toLocaleString("fr-FR")}
          </p>
        </div>
      )}
    </section>
  );
}
