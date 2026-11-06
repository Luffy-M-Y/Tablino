"use client";

import { useActionState } from "react";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/ui/kit";
import { registerAction } from "./actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, { message: null });

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="firstName" className={labelClass}>
          Pr&eacute;nom
        </label>
        <input
          id="firstName"
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="lastName" className={labelClass}>
          Nom
        </label>
        <input
          id="lastName"
          name="lastName"
          type="text"
          autoComplete="family-name"
          required
          className={inputClass}
        />
      </div>
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
      <div>
        <label htmlFor="password" className={labelClass}>
          Mot de passe
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
        <label
          htmlFor="passwordConfirmation"
          className={labelClass}
        >
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
      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        Cr&eacute;er mon compte
      </button>
      {state.message !== null ? (
        <p className={errorClass} role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
