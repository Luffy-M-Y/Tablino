"use client";

import { signIn } from "next-auth/react";

export function GoogleSignInButton() {
  return (
    <button
      type="button"
      onClick={() => { void signIn("google", { callbackUrl: "/" }); }}
      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-100"
    >
      Continuer avec Google
    </button>
  );
}
