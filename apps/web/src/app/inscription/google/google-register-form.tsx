"use client";

import { useActionState, useEffect, useState } from "react";
import { errorClass, inputClass, labelClass, mutedClass, primaryButtonClass } from "@/components/ui/kit";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { registerGoogleAction } from "./actions";
import { PendingLabel } from "@/components/ui/PendingLabel";

export function GoogleRegisterForm({
  token,
  requiresAccessCode,
}: {
  token: string;
  requiresAccessCode: boolean;
}) {
  const [state, action, pending] = useActionState(registerGoogleAction, { message: null });
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.redirectTo]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <TurnstileField
        action="signup_google"
        onTokenChange={setTurnstileToken}
        resetKey={state}
      />
      {requiresAccessCode ? (
        <div>
          <label htmlFor="accessCode" className={labelClass}>
            Code d&rsquo;acc&egrave;s
          </label>
          <input
            id="accessCode"
            name="accessCode"
            type="text"
            autoComplete="off"
            required
            className={inputClass}
          />
        </div>
      ) : (
        <p className={`text-sm ${mutedClass}`}>
          Aucun code d&rsquo;acc&egrave;s n&rsquo;est n&eacute;cessaire pour cette universit&eacute;.
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !turnstileToken}
        className={primaryButtonClass}
      >
        <PendingLabel pending={pending} pendingText="Création en cours…">Cr&eacute;er mon compte</PendingLabel>
      </button>
      {state.message !== null ? (
        <p className={errorClass} role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
