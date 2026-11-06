"use client";

import { useActionState } from "react";
import { revokeCodeAction } from "./actions";

export function RevokeCodeForm({ codeId }: { codeId: string }) {
  const [state, formAction, pending] = useActionState(revokeCodeAction, { message: null });

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="codeId" value={codeId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2 text-sm font-semibold text-[color:var(--color-text)] disabled:opacity-60"
      >
        Révoquer
      </button>
      {state.message && <p role="status" className="text-sm text-slate-700">{state.message}</p>}
    </form>
  );
}
