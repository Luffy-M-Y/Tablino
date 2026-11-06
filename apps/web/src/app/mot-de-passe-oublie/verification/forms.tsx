"use client";

import { useActionState, useEffect, useState } from "react";
import { errorClass, inputClass, labelClass, mutedClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/kit";
import { resendResetCodeAction, verifyResetCodeAction } from "./actions";

export function ResetVerificationForms() {
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyResetCodeAction,
    { message: null },
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendResetCodeAction,
    { message: null },
  );
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(function () {
    if (resendState.message === "Un nouveau code a \u00e9t\u00e9 envoy\u00e9.") setSecondsLeft(60);
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
        <button
          type="submit"
          disabled={verifyPending}
          className={primaryButtonClass}
        >
          V&eacute;rifier
        </button>
        {verifyState.message !== null ? (
          <p className={errorClass} role="alert">{verifyState.message}</p>
        ) : null}
      </form>
      <form action={resendAction} className="space-y-3">
        <button
          type="submit"
          disabled={resendPending || secondsLeft > 0}
          className={secondaryButtonClass}
        >
          {secondsLeft > 0 ? "Renvoyer le code (" + secondsLeft + " s)" : "Renvoyer le code"}
        </button>
        {resendState.message !== null ? (
          <p className={`text-sm ${mutedClass}`} role="status">{resendState.message}</p>
        ) : null}
      </form>
    </div>
  );
}
