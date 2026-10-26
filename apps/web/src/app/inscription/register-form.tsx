"use client";

import { useActionState } from "react";
import { registerAction } from "./actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, { message: null });

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-slate-700">
          Prénom
        </label>
        <input
          id="firstName"
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
      </div>
      <div>
        <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-slate-700">
          Nom
        </label>
        <input
          id="lastName"
          name="lastName"
          type="text"
          autoComplete="family-name"
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
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
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
      </div>
      <div>
        <label
          htmlFor="passwordConfirmation"
          className="mb-1 block text-sm font-medium text-slate-700"
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
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
      </div>
      <div>
        <label htmlFor="accessCode" className="mb-1 block text-sm font-medium text-slate-700">
          Code d’accès
        </label>
        <input
          id="accessCode"
          name="accessCode"
          type="text"
          autoComplete="off"
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-uni-800 px-4 py-3 font-semibold text-white hover:bg-uni-700 disabled:cursor-wait disabled:opacity-70"
      >
        Créer mon compte
      </button>
      {state.message !== null ? (
        <p className="text-sm text-red-700" role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
