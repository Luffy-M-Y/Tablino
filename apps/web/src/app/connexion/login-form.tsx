"use client";

import { useActionState, useEffect, useState } from "react";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/ui/kit";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { loginAction } from "./actions";
import { PendingLabel } from "@/components/ui/PendingLabel";

export function LoginForm({ defaultEmail }: { defaultEmail?: string } = {}) {
  const [state, action, pending] = useActionState(loginAction, { message: null });
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
          defaultValue={defaultEmail}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <TurnstileField
        action="login"
        onTokenChange={setTurnstileToken}
        resetKey={state}
      />
      <button
        aria-busy={pending}
        type="submit"
        disabled={pending || !turnstileToken}
        className={primaryButtonClass}
      >
        <PendingLabel pending={pending} pendingText="Connexion en cours…">Se connecter</PendingLabel>
      </button>
      {state.message !== null ? (
        <p className={errorClass} role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
