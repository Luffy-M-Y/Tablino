"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  adminFieldClass,
  adminLabelClass,
  adminPrimaryButtonClass,
} from "@/components/admin-ui";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { PendingLabel } from "@/components/pending-label";
import {
  resendInvitationCodeAction,
  startAdminInvitationGoogleAction,
  startInvitationAcceptanceAction,
  verifyInvitationCodeAction,
  type AcceptInvitationActionState,
} from "./actions";

const initialState: AcceptInvitationActionState = {
  message: null,
  status: "idle",
  step: "password",
};
const RESEND_COOLDOWN_SECONDS = 60;

export function AcceptInvitationForm() {
  const [startState, startAction, startPending] = useActionState(
    startInvitationAcceptanceAction,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyInvitationCodeAction,
    initialState,
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendInvitationCodeAction,
    initialState,
  );
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  // Champ contrôlé : React 19 vide un champ libre après chaque envoi, même en erreur.
  const [code, setCode] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);
  // Code refusé : il reste affiché, sélectionné ; une frappe le remplace, on peut aussi corriger un chiffre.
  useEffect(() => {
    if (verifyState.message !== null) codeInputRef.current?.select();
  }, [verifyState]);
  const [startToken, setStartToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [resendToken, setResendToken] = useState("");
  const showCodeStep = startState.step === "code";

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (resendState.status === "success") {
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setResendToken("");
    }
  }, [resendState]);

  return showCodeStep ? (
    <div className="space-y-6">
      {startState.message ? (
        <p
          role={startState.status === "success" ? "status" : "alert"}
          className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-3 text-sm"
        >
          {startState.message}
        </p>
      ) : null}
      <form action={verifyAction} className="space-y-5">
        <div>
          <label htmlFor="invitation-code" className={adminLabelClass}>
            Code de confirmation
          </label>
          <input
            id="invitation-code"
            name="code"
            ref={codeInputRef}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className={`${adminFieldClass} text-center text-xl tracking-widest`}
          />
        </div>
        <TurnstileField
          action="admin_invitation_verify"
          onTokenChange={setVerifyToken}
          resetKey={verifyState}
        />
        {verifyState.message ? (
          <p role="alert" className="rounded-[var(--radius-rounded)] border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {verifyState.message}
          </p>
        ) : null}
        <button
          type="submit"
          aria-busy={verifyPending}
          disabled={verifyPending || !verifyToken}
          className={adminPrimaryButtonClass}
        >
          <PendingLabel pending={verifyPending} pendingText="Vérification en cours…">Confirmer le code</PendingLabel>
        </button>
      </form>

      <form action={resendAction} className="space-y-3">
        {secondsLeft === 0 ? (
          <TurnstileField
            action="admin_invitation_resend"
            onTokenChange={setResendToken}
            resetKey={resendState}
          />
        ) : null}
        {resendState.message ? (
          <p role={resendState.status === "success" ? "status" : "alert"} className="text-sm">
            {resendState.message}
          </p>
        ) : null}
        <button
          type="submit"
          aria-busy={resendPending}
          disabled={resendPending || secondsLeft > 0 || !resendToken}
          className={adminPrimaryButtonClass}
        >
          <PendingLabel pending={resendPending} pendingText="Envoi en cours…">
            {secondsLeft > 0 ? `Renvoyer le code (${secondsLeft} s)` : "Renvoyer le code"}
          </PendingLabel>
        </button>
      </form>
    </div>
  ) : (
    <>
      <form action={startAction} className="space-y-5">
        <div>
          <label htmlFor="invitation-password" className={adminLabelClass}>
            Mot de passe
          </label>
          <input
            id="invitation-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            className={adminFieldClass}
          />
        </div>
        <div>
          <label htmlFor="invitation-password-confirmation" className={adminLabelClass}>
            Confirmer le mot de passe
          </label>
          <input
            id="invitation-password-confirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            className={adminFieldClass}
          />
        </div>
        <TurnstileField
          action="admin_invitation_start"
          onTokenChange={setStartToken}
          resetKey={startState}
        />
        {startState.message ? (
          <p role="alert" className="rounded-[var(--radius-rounded)] border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {startState.message}
          </p>
        ) : null}
        <button
          type="submit"
          aria-busy={startPending}
          disabled={startPending || !startToken}
          className={adminPrimaryButtonClass}
        >
          <PendingLabel pending={startPending} pendingText="Envoi du code…">Envoyer le code de confirmation</PendingLabel>
        </button>
      </form>
      <div className="my-5 flex items-center gap-3 text-sm text-[color:var(--color-muted-foreground)]">
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--color-border)]" />
        ou
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--color-border)]" />
      </div>
      <GoogleInvitationButton />
    </>
  );
}

export function GoogleInvitationButton() {
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  async function startGoogleSignIn() {
    setGooglePending(true);
    setGoogleError(null);
    try {
      const result = await startAdminInvitationGoogleAction();
      if (!result.ok) {
        setGoogleError(result.message);
        setGooglePending(false);
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = result.action;

      const kindField = document.createElement("input");
      kindField.type = "hidden";
      kindField.name = "kind";
      kindField.value = "invitation";
      form.appendChild(kindField);

      const ticketField = document.createElement("input");
      ticketField.type = "hidden";
      ticketField.name = "ticket";
      ticketField.value = result.ticket;
      form.appendChild(ticketField);

      document.body.appendChild(form);
      form.submit();
    } catch {
      setGoogleError("Cette invitation n'est plus disponible.");
      setGooglePending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={googlePending}
        onClick={() => { void startGoogleSignIn(); }}
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-4 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-page-background)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
        aria-busy={googlePending}
      >
        <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px]">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        <PendingLabel pending={googlePending} pendingText="Connexion en cours…">Continuer avec Google</PendingLabel>
      </button>
      {googleError ? (
        <p role="alert" className="mt-2 text-sm text-[color:var(--color-destructive-text)]">
          {googleError}
        </p>
      ) : null}
    </>
  );
}
