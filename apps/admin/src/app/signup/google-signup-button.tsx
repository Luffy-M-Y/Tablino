"use client";

import { useState } from "react";
import { startUniversityGoogleSignupAction } from "./actions";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

export function GoogleSignupButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startGoogleSignup() {
    setPending(true);
    setError(null);
    try {
      const result = await startUniversityGoogleSignupAction();
      if (!result.ok) {
        setError(result.message);
        setPending(false);
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
      const kindField = document.createElement("input");
      kindField.type = "hidden";
      kindField.name = "kind";
      kindField.value = result.kind;
      form.appendChild(kindField);
      document.body.appendChild(form);
      form.submit();
    } catch {
      setError("Impossible de démarrer l'inscription. Réessayez.");
      setPending(false);
    }
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => { void startGoogleSignup(); }}
        className={`inline-flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-4 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-page-background)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${focusRing}`}
        aria-busy={pending}
      >
        <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px]">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        {pending ? "Redirection en cours…" : "Continuer avec Google"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-[color:var(--color-destructive-text)]">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-3 text-sm text-[color:var(--color-muted-foreground)]">
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--color-border)]" />
        ou avec une adresse e-mail
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--color-border)]" />
      </div>
    </div>
  );
}
