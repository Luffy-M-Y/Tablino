"use client";

import { useRef, useState } from "react";
import { adminSecondaryButtonClass } from "@/components/admin-ui";

type GoogleSignInFormProps = {
  action: string;
  method: "post";
  callbackUrl: string;
  csrfFieldName: string;
  callbackUrlFieldName: string;
};

export function GoogleSignInForm({
  action,
  method,
  callbackUrl,
  csrfFieldName,
  callbackUrlFieldName,
}: GoogleSignInFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const csrfTokenRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSignIn() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/csrf", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("CSRF token request failed.");

      const result: unknown = await response.json();
      if (
        typeof result !== "object"
        || result === null
        || !("csrfToken" in result)
        || typeof result.csrfToken !== "string"
        || result.csrfToken.length === 0
      ) {
        throw new Error("CSRF token response is invalid.");
      }

      if (!csrfTokenRef.current || !formRef.current) {
        throw new Error("Sign-in form is unavailable.");
      }
      csrfTokenRef.current.value = result.csrfToken;
      formRef.current.requestSubmit();
    } catch {
      setIsLoading(false);
      setError("Impossible de démarrer la connexion. Réessayez.");
    }
  }

  return (
    <form ref={formRef} method={method} action={action} className="mt-5 space-y-4">
      <input ref={csrfTokenRef} type="hidden" name={csrfFieldName} />
      <input type="hidden" name={callbackUrlFieldName} value={callbackUrl} />
      <button
        type="button"
        onClick={() => { void startSignIn(); }}
        className={`${adminSecondaryButtonClass} w-full`}
        aria-busy={isLoading}
      >
        {isLoading ? "Connexion en cours…" : "Continuer avec Google"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
