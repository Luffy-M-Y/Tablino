"use client";

import { useActionState, useEffect, useState } from "react";
import {
  errorClass,
  inputClass,
  labelClass,
  mutedClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth-ui";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { resendResetCodeAction, verifyResetCodeAction } from "./actions";

const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_SUCCESS_MESSAGE =
  "Si le compte est admissible, un nouveau code a été envoyé.";

export function ResetVerificationForms() {
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyResetCodeAction,
    { message: null },
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendResetCodeAction,
    { message: null },
  );
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [verifyTurnstileToken, setVerifyTurnstileToken] = useState("");
  const [resendTurnstileToken, setResendTurnstileToken] = useState("");

  useEffect(() => {
    if (resendState.message === RESEND_SUCCESS_MESSAGE) {
      setResendTurnstileToken("");
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    }
  }, [resendState]);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <div className="space-y-6">
      <form action={verifyAction} className="space-y-4">
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
            className={`${inputClass} text-center text-xl tracking-widest`}
          />
        </div>
        <TurnstileField
          action="password_reset_verify"
          onTokenChange={setVerifyTurnstileToken}
          resetKey={verifyState}
        />
        {verifyState.message !== null ? (
          <p role="alert" className={errorClass}>{verifyState.message}</p>
        ) : null}
        <button
          type="submit"
          disabled={verifyPending || !verifyTurnstileToken}
          className={primaryButtonClass}
        >
          V&eacute;rifier
        </button>
      </form>

      <form action={resendAction} className="space-y-3">
        {secondsLeft === 0 ? (
          <TurnstileField
            action="password_reset_resend"
            onTokenChange={setResendTurnstileToken}
            resetKey={resendState}
          />
        ) : null}
        <button
          type="submit"
          disabled={resendPending || secondsLeft > 0 || !resendTurnstileToken}
          className={`${secondaryButtonClass} disabled:opacity-60`}
        >
          {secondsLeft > 0 ? `Renvoyer le code (${secondsLeft} s)` : "Renvoyer le code"}
        </button>
        {resendState.message !== null ? (
          <p role="status" className={`text-sm ${mutedClass}`}>{resendState.message}</p>
        ) : null}
      </form>
    </div>
  );
}
