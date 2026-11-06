"use client";

import { useActionState, useEffect, useState } from "react";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth-ui";
import { resendCodeAction, verifyCodeAction } from "./actions";

export function VerificationForm() {
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCodeAction,
    { message: null },
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendCodeAction,
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
        {verifyState.message !== null && (
          <p role="alert" className={errorClass}>
            {verifyState.message}
          </p>
        )}
        <button
          type="submit"
          disabled={verifyPending}
          className={primaryButtonClass}
        >
          V&eacute;rifier
        </button>
      </form>

      <form action={resendAction} className="space-y-3">
        <button
          type="submit"
          disabled={resendPending || secondsLeft > 0}
          className={`${secondaryButtonClass} disabled:opacity-60`}
        >
          {secondsLeft > 0 ? `Renvoyer le code (${secondsLeft} s)` : "Renvoyer le code"}
        </button>
        {resendState.message !== null && (
          <p role="status" className="text-sm text-[color:var(--color-muted-foreground)]">
            {resendState.message}
          </p>
        )}
      </form>
    </div>
  );
}
