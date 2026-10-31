"use client";

import { useActionState } from "react";
import { signIn } from "next-auth/react";
import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = {
  message: null,
  email: "",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-2 block font-medium">
            Adresse e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            key={state.email}
            className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block font-medium">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Connexion en cours…" : "Se connecter"}
        </button>
        {state.message !== null && (
          <p role="alert" className="text-sm text-red-700">{state.message}</p>
        )}
      </form>

      <div className="my-6 flex items-center gap-3 text-sm text-slate-500">
        <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
        ou
        <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={() => { void signIn("google", { callbackUrl: "/" }); }}
        className="w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white px-4 py-3 font-semibold text-[color:var(--color-text)] hover:bg-slate-50"
      >
        Continuer avec Google
      </button>
    </section>
  );
}
