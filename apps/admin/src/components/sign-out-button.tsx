"use client";

import { signOut } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { runSignOutToLogin } from "@/lib/sign-out.mjs";

/** Déconnexion vers « /login » de l'hôte courant. */
export function signOutToLogin(): Promise<boolean> {
  return runSignOutToLogin({
    signOut: (options) => signOut(options),
    assign: (url) => window.location.assign(url),
  });
}

type Props = {
  className?: string;
  children: ReactNode;
};

export function SignOutButton({ className, children }: Props) {
  const [isPending, setIsPending] = useState(false);

  return (
    <button
      type="button"
      className={className}
      aria-busy={isPending}
      disabled={isPending}
      onClick={() => {
        setIsPending(true);
        void signOutToLogin().then((ok) => {
          if (!ok) setIsPending(false);
        });
      }}
    >
      {children}
    </button>
  );
}
