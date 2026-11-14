"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { TurnstileField } from "@/components/auth/TurnstileField";
import {
  loginAction,
  startAdminGoogleSignInAction,
  type LoginActionState,
} from "./actions";
import { getAdminGoogleExistingAccountMessage } from "@/lib/admin-google-existing-account.mjs";

const initialState: LoginActionState = {
  message: null,
  email: "",
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";
const labelClass =
  "mb-1.5 block text-sm font-semibold text-[color:var(--color-text)]";
const inputClass = `h-11 w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-3 text-base text-[color:var(--color-text)] ${focusRing}`;

export function LoginForm({
  passwordResetComplete = false,
  googleExistingEmail,
  showGoogleSignIn = false,
  googleSignInError = null,
}: {
  passwordResetComplete?: boolean;
  googleExistingEmail?: string;
  showGoogleSignIn?: boolean;
  googleSignInError?: string | null;
}) {
  const [state, formAction, pending] = useActionState(loginAction, {
    ...initialState,
    email: googleExistingEmail ?? "",
  });
  const googleExistingMessage = getAdminGoogleExistingAccountMessage(googleExistingEmail);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState(googleSignInError);

  async function startGoogleSignIn() {
    setGooglePending(true);
    setGoogleError(null);
    try {
      const result = await startAdminGoogleSignInAction();
      if (!result.ok) {
        setGoogleError(result.message);
        setGooglePending(false);
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = result.action;
      const ticketField = document.createElement("input");
      ticketField.type = "hidden";
      ticketField.name = "ticket";
      ticketField.value = result.ticket;
      form.appendChild(ticketField);
      document.body.appendChild(form);
      form.submit();
    } catch {
      setGoogleError("Impossible de démarrer la connexion. Réessayez.");
      setGooglePending(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:p-6">
      {passwordResetComplete ? (
        <p
          role="status"
          className="mb-4 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-text)]"
        >
          Mot de passe r&eacute;initialis&eacute;. Connectez-vous avec votre nouveau mot de passe.
        </p>
      ) : null}
      {googleExistingMessage ? (
        <p
          role="status"
          className="mb-4 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-text)]"
        >
          {googleExistingMessage}
        </p>
      ) : null}
      <form action={formAction} className="space-y-4">
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
            defaultValue={state.email}
            key={state.email}
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
        {state.message !== null && (
          <p
            role="alert"
            className="rounded-[var(--radius-rounded)] border border-[color:var(--color-destructive)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-medium text-[color:var(--color-destructive-text)]"
          >
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || !turnstileToken}
          className={`h-11 w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-primary)] px-4 font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${focusRing}`}
        >
          {pending ? "Connexion en cours\u2026" : "Se connecter"}
        </button>
      </form>

      <p className="mt-3 text-center text-sm text-[color:var(--color-muted-foreground)]">
        <Link
          href="/mot-de-passe-oublie"
          className={`inline-block px-1 py-3 font-semibold text-[color:var(--color-primary-text)] underline underline-offset-2 ${focusRing}`}
        >
          Mot de passe oubli&eacute; ?
        </Link>
      </p>
      {showGoogleSignIn ? (
        <>
          <div className="my-4 flex items-center gap-3 text-sm text-[color:var(--color-muted-foreground)]">
            <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--color-border)]" />
            ou
            <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--color-border)]" />
          </div>
          <button
            type="button"
            disabled={googlePending}
            onClick={() => { void startGoogleSignIn(); }}
            className={`inline-flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-4 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-page-background)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${focusRing}`}
            aria-busy={googlePending}
          >
            <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px]">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            {googlePending ? "Connexion en cours…" : "Continuer avec Google"}
          </button>
          {googleError ? (
            <p role="alert" className="mt-2 text-sm text-[color:var(--color-destructive-text)]">
              {googleError}
            </p>
          ) : null}
        </>
      ) : null}
      <p className="mt-3 text-center text-sm text-[color:var(--color-muted-foreground)]">
        Vous n'avez pas de compte ?{" "}
        <Link
          href="/signup"
          className={`inline-block px-1 py-3 font-semibold text-[color:var(--color-primary-text)] underline underline-offset-2 ${focusRing}`}
        >
          S'inscrire
        </Link>
      </p>
    </section>
  );
}
