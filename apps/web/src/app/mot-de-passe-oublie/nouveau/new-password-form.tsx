"use client";

import { useActionState } from "react";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/ui/kit";
import { setNewPasswordAction } from "./actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(setNewPasswordAction, { message: null });

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
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        R&eacute;initialiser le mot de passe
      </button>
      {state.message !== null ? (
        <p className={errorClass} role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
