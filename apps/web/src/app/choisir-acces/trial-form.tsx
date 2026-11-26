"use client";

import { useActionState, useEffect } from "react";
import { errorClass, primaryButtonClass } from "@/components/ui/kit";
import { startTrialAction } from "./actions";
import { PendingLabel } from "@/components/ui/PendingLabel";

export function TrialForm() {
  const [state, action, pending] = useActionState(startTrialAction, { message: null });

  useEffect(() => {
    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.redirectTo]);

  return (
    <form action={action}>
      <button
        aria-busy={pending}
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        <PendingLabel pending={pending} pendingText="Activation en cours…">Commencer l&rsquo;essai gratuit (1 mois)</PendingLabel>
      </button>
      {state.message !== null ? (
        <p className={`mt-3 ${errorClass}`} role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
