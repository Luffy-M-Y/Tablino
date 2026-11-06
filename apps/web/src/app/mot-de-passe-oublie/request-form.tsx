"use client";

import { useActionState } from "react";
import { inputClass, labelClass, mutedClass, primaryButtonClass } from "@/components/ui/kit";
import { requestResetAction } from "./actions";

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestResetAction, { message: null });

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
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        Envoyer le code
      </button>
      {state.message !== null ? (
        <p className={`text-sm ${mutedClass}`} role="status">{state.message}</p>
      ) : null}
    </form>
  );
}
