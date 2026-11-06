"use client";

import { useActionState } from "react";
import { errorClass, primaryButtonClass } from "@/components/ui/kit";
import { startTrialAction } from "./actions";

export function TrialForm() {
  const [state, action, pending] = useActionState(startTrialAction, { message: null });

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        Commencer l&rsquo;essai gratuit (1 mois)
      </button>
      {state.message !== null ? (
        <p className={`mt-3 ${errorClass}`} role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
