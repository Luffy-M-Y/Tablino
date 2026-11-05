"use client";

import { signIn } from "next-auth/react";
import { secondaryButtonClass } from "@/components/ui/kit";

export function GoogleSignInButton() {
  return (
    <button
      type="button"
      onClick={() => { void signIn("google", { callbackUrl: "/" }); }}
      className={secondaryButtonClass}
    >
      Continuer avec Google
    </button>
  );
}
