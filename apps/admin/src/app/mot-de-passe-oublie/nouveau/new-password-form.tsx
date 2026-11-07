"use client";

import { useActionState, useState } from "react";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/auth-ui";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { setNewPasswordAction } from "./actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(setNewPasswordAction, { message: null });
  const [turnstileToken, setTurnstileToken] = useState("");

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
        {pending ? "Mise à jour en cours\u2026" : "Réinitialiser le mot de passe"}
      </button>
      {state.message !== null ? (
        <p className={errorClass} role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
