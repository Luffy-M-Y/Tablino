"use client";

import { useActionState } from "react";
import { registerGoogleAction } from "./actions";

export function GoogleRegisterForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(registerGoogleAction, { message: null });

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="accessCode" className="mb-1 block text-sm font-medium text-slate-700">
          Code d'accès
        </label>
        <input
          id="accessCode"
          name="accessCode"
          type="text"
          autoComplete="off"
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-uni-800 px-4 py-3 font-semibold text-white hover:bg-uni-700 disabled:cursor-wait disabled:opacity-70"
      >
        Créer mon compte
      </button>
      {state.message !== null ? (
        <p className="text-sm text-red-700" role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
