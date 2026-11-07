"use client";

import { useActionState, useState } from "react";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/ui/kit";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { registerGoogleAction } from "./actions";

export function GoogleRegisterForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(registerGoogleAction, { message: null });
  const [turnstileToken, setTurnstileToken] = useState("");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <TurnstileField
        action="signup_google"
        onTokenChange={setTurnstileToken}
        resetKey={state}
      />
      <div>
        <label htmlFor="accessCode" className={labelClass}>
          Code d&rsquo;acc&egrave;s
        </label>
        <input
          id="accessCode"
          name="accessCode"
          type="text"
          autoComplete="off"
          required
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={pending || !turnstileToken}
        className={primaryButtonClass}
      >
        Cr&eacute;er mon compte
      </button>
      {state.message !== null ? (
        <p className={errorClass} role="alert">{state.message}</p>
      ) : null}
    </form>
  );
}
