"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  registerUniversityAction,
  type UniversitySignupActionState,
} from "./actions";

const initialState: UniversitySignupActionState = {
  message: null,
  universityName: "",
  showForm: true,
  showLoginLink: false,
};

export function UniversitySignupForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(registerUniversityAction, initialState);

  return (
    <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
      <p className="mb-6 text-sm text-slate-600">Compte Google : {email}</p>
      {state.message && (
        <p role="alert" className="mb-4 text-sm text-red-700">{state.message}</p>
      )}
      {state.showForm && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="universityName" className="mb-2 block font-medium">
              Nom de l'université
            </label>
            <input
              id="universityName"
              name="universityName"
              type="text"
              minLength={1}
              maxLength={255}
              required
              defaultValue={state.universityName}
              key={state.universityName}
              autoComplete="organization"
              className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Envoi en cours…" : "Créer l'université"}
          </button>
        </form>
      )}
      {state.showLoginLink && (
        <Link
          href="/api/auth/signin"
          className="inline-block font-semibold text-[color:var(--color-university-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        >
          Aller à la connexion admin
        </Link>
      )}
    </section>
  );
}
