"use client";

import { useActionState, useEffect, useState } from "react";
import { inputClass, labelClass, mutedClass, primaryButtonClass } from "@/components/ui/kit";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { requestResetAction } from "./actions";

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestResetAction, { message: null });
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.redirectTo]);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className={labelClass}>
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      <TurnstileField
        action="password_reset_request"
        onTokenChange={setTurnstileToken}
        resetKey={state}
      />
      <button
        type="submit"
        disabled={pending || !turnstileToken}
        className={primaryButtonClass}
      >
        Envoyer le code
      </button>
      {state.message !== null ? (
        <p className={`text-sm ${mutedClass}`} role="status">{state.message}</p>
      ) : null}
    </form>
  );
}
