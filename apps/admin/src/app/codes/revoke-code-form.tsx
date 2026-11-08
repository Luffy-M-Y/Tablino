"use client";

import { useActionState } from "react";
import { adminSecondaryButtonClass } from "@/components/admin-ui";
import { revokeCodeAction } from "./actions";

export function RevokeCodeForm({ codeId }: { codeId: string }) {
  const [state, formAction, pending] = useActionState(revokeCodeAction, { message: null });

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="codeId" value={codeId} />
      <button
        type="submit"
        disabled={pending}
        className={`${adminSecondaryButtonClass} border-red-200 bg-red-50 text-red-800 hover:bg-red-100 focus-visible:outline-red-700`}
      >
        Révoquer
      </button>
      {state.message && <p role="status" className="text-sm text-slate-700">{state.message}</p>}
    </form>
  );
}
