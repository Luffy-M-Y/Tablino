"use client";

import { useActionState, useEffect, useState } from "react";
import {
  adminFieldClass,
  adminLabelClass,
  adminPrimaryButtonClass,
} from "@/components/admin-ui";
import { TurnstileField } from "@/components/auth/TurnstileField";
import {
  resendInvitationCodeAction,
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
          disabled={verifyPending || !verifyToken}
          className={adminPrimaryButtonClass}
        >
          {verifyPending ? "Vérification en cours…" : "Confirmer le code"}
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
          disabled={resendPending || secondsLeft > 0 || !resendToken}
          className={adminPrimaryButtonClass}
        >
          {secondsLeft > 0 ? `Renvoyer le code (${secondsLeft} s)` : "Renvoyer le code"}
        </button>
      </form>
    </div>
  ) : (
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
        disabled={startPending || !startToken}
        className={adminPrimaryButtonClass}
      >
        {startPending ? "Envoi du code…" : "Envoyer le code de confirmation"}
      </button>
    </form>
  );
}
