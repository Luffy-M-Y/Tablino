"use client";

import { useActionState } from "react";
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
          disabled={resendPending}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
        >
          Renvoyer le code
        </button>
        {resendState.message !== null ? (
          <p className="text-sm text-slate-600" role="status">{resendState.message}</p>
        ) : null}
      </form>
    </div>
  );
}
