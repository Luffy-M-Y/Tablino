"use client";

import { useActionState, useEffect, useState } from "react";
import { errorClass, inputClass, labelClass, mutedClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/kit";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { PendingLabel } from "@/components/ui/PendingLabel";
import { resendCodeAction, verifyCodeAction } from "./actions";

const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_SUCCESS_MESSAGE = "Un nouveau code a été envoyé.";

export function VerificationForms() {
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCodeAction,
    { message: null },
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendCodeAction,
    { message: null },
  );
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [verifyTurnstileToken, setVerifyTurnstileToken] = useState("");
  const [resendTurnstileToken, setResendTurnstileToken] = useState("");
  useEffect(() => {
    if (verifyState.redirectTo) {
      window.location.assign(verifyState.redirectTo);
    }
  }, [verifyState.redirectTo]);
  useEffect(() => {
    if (resendState.redirectTo) {
      window.location.assign(resendState.redirectTo);
    }
  }, [resendState.redirectTo]);
  useEffect(function () {
    if (resendState.message === RESEND_SUCCESS_MESSAGE) {
      setResendTurnstileToken("");
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    }
  }, [resendState]);
  useEffect(function () {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(function () {
      setSecondsLeft(secondsLeft - 1);
    }, 1000);
    return function () {
      clearTimeout(timer);
    };
  }, [secondsLeft]);

  return (
    <div className="space-y-6">
      <form action={verifyAction} className="space-y-5">
        <div>
          <label htmlFor="code" className={labelClass}>
            Code de v&eacute;rification
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className={inputClass}
          />
        </div>
        <TurnstileField
          action="email_verify"
          onTokenChange={setVerifyTurnstileToken}
          resetKey={verifyState}
        />
        <button
          type="submit"
          aria-busy={verifyPending}
          disabled={verifyPending || !verifyTurnstileToken}
          className={primaryButtonClass}
        >
          <PendingLabel pending={verifyPending} pendingText="Vérification…">V&eacute;rifier</PendingLabel>
        </button>
        {verifyState.message !== null ? (
          <p className={errorClass} role="alert">{verifyState.message}</p>
        ) : null}
      </form>
      <form action={resendAction} className="space-y-3">
        {secondsLeft === 0 ? (
          <TurnstileField
            action="email_resend"
            onTokenChange={setResendTurnstileToken}
            resetKey={resendState}
          />
        ) : null}
        <button
          type="submit"
          aria-busy={resendPending}
          disabled={resendPending || secondsLeft > 0 || !resendTurnstileToken}
          className={secondaryButtonClass}
        >
          <PendingLabel pending={resendPending} pendingText="Envoi en cours…">
            {secondsLeft > 0 ? "Renvoyer le code (" + secondsLeft + " s)" : "Renvoyer le code"}
          </PendingLabel>
        </button>
        {resendState.message !== null ? (
          <p className={`text-sm ${mutedClass}`} role="status">{resendState.message}</p>
        ) : null}
      </form>
    </div>
  );
}
