"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  errorClass,
  inputClass,
  labelClass,
  mutedClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth-ui";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { PendingLabel } from "@/components/pending-label";
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
  // Champ contrôlé : React 19 vide un champ libre après chaque envoi, même en erreur.
  const [code, setCode] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);
  // Code refusé : il reste affiché, sélectionné ; une frappe le remplace, on peut aussi corriger un chiffre.
  useEffect(() => {
    if (verifyState.message !== null) codeInputRef.current?.select();
  }, [verifyState]);
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
            ref={codeInputRef}
            value={code}
            onChange={(event) => setCode(event.target.value)}
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
          aria-busy={verifyPending}
          disabled={verifyPending || !verifyTurnstileToken}
          className={primaryButtonClass}
        >
          <PendingLabel pending={verifyPending} pendingText="Vérification…">V&eacute;rifier</PendingLabel>
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
          aria-busy={resendPending}
          disabled={resendPending || secondsLeft > 0 || !resendTurnstileToken}
          className={`${secondaryButtonClass} disabled:opacity-60`}
        >
          <PendingLabel pending={resendPending} pendingText="Envoi en cours…">
            {secondsLeft > 0 ? `Renvoyer le code (${secondsLeft} s)` : "Renvoyer le code"}
          </PendingLabel>
        </button>
        {resendState.message !== null ? (
          <p role="status" className={`text-sm ${mutedClass}`}>{resendState.message}</p>
        ) : null}
      </form>
    </div>
  );
}
