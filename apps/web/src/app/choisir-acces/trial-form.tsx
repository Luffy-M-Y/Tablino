"use client";

import { useActionState } from "react";
import { startTrialAction } from "./actions";

export function TrialForm() {
  const [state, action, pending] = useActionState(startTrialAction, { message: null });

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-uni-800 shadow hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
      >
        Commencer l’essai gratuit (1 mois)
      </button>
      {state.message !== null ? (
        <p className="mt-3 text-sm text-white" role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
