"use client";

import { useActionState, useEffect, useState } from "react";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/ui/kit";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { setNewPasswordAction } from "./actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(setNewPasswordAction, { message: null });
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.redirectTo]);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="password" className={labelClass}>
          Nouveau mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="passwordConfirmation" className={labelClass}>
          Confirmation du mot de passe
        </label>
        <input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          className={inputClass}
        />
      </div>
      <TurnstileField
        action="password_reset_set"
        onTokenChange={setTurnstileToken}
        resetKey={state}
      />
      <button
        type="submit"
        disabled={pending || !turnstileToken}
        className={primaryButtonClass}
      >
        R&eacute;initialiser le mot de passe
      </button>
      {state.message !== null ? (
        <p className={errorClass} role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
