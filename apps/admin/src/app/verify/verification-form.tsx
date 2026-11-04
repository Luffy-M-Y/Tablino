"use client";

import { useActionState, useEffect, useState } from "react";
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
    if (resendState.message === "Un nouveau code a été envoyé.") setSecondsLeft(60);
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
          <label htmlFor="code" className="mb-2 block font-medium">
            Code de vérification
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
          />
        </div>
        <button
          type="submit"
          disabled={verifyPending}
          className="w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          Vérifier
        </button>
        {verifyState.message !== null && (
          <p role="alert" className="text-sm text-red-700">{verifyState.message}</p>
        )}
      </form>

      <form action={resendAction} className="space-y-3">
        <button
          type="submit"
          disabled={resendPending || secondsLeft > 0}
          className="w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white px-4 py-3 font-semibold text-[color:var(--color-text)] hover:bg-slate-50 disabled:opacity-60"
        >
          {secondsLeft > 0 ? `Renvoyer le code (${secondsLeft} s)` : "Renvoyer le code"}
        </button>
        {resendState.message !== null && (
          <p role="status" className="text-sm text-slate-600">{resendState.message}</p>
        )}
      </form>
    </div>
  );
}
