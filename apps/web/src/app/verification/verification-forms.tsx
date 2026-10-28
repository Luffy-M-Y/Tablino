"use client";

import { useActionState, useEffect, useState } from "react";
import { resendCodeAction, verifyCodeAction } from "./actions";

export function VerificationForms() {
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
          <label htmlFor="code" className="mb-1 block text-sm font-medium text-slate-700">
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
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
          />
        </div>
        <button
          type="submit"
          disabled={verifyPending}
          className="w-full rounded-xl bg-uni-800 px-4 py-3 font-semibold text-white hover:bg-uni-700 disabled:cursor-wait disabled:opacity-70"
        >
          Vérifier
        </button>
        {verifyState.message !== null ? (
          <p className="text-sm text-red-700" role="alert">{verifyState.message}</p>
        ) : null}
      </form>
      <form action={resendAction} className="space-y-3">
        <button
          type="submit"
          disabled={resendPending || secondsLeft > 0}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
        >
          {secondsLeft > 0 ? "Renvoyer le code (" + secondsLeft + " s)" : "Renvoyer le code"}
        </button>
        {resendState.message !== null ? (
          <p className="text-sm text-slate-600" role="status">{resendState.message}</p>
        ) : null}
      </form>
    </div>
  );
}
