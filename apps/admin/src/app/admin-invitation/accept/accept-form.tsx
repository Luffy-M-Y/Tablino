"use client";

import { useActionState } from "react";
import {
  adminFieldClass,
  adminLabelClass,
  adminPrimaryButtonClass,
} from "@/components/admin-ui";
import {
  acceptInvitationAction,
  type AcceptInvitationActionState,
} from "./actions";

const initialState: AcceptInvitationActionState = {
  message: null,
  status: "idle",
};

export function AcceptInvitationForm() {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="invitation-password" className={adminLabelClass}>
          Mot de passe
        </label>
        <input
          id="invitation-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className={adminFieldClass}
        />
      </div>
      <div>
        <label htmlFor="invitation-password-confirmation" className={adminLabelClass}>
          Confirmer le mot de passe
        </label>
        <input
          id="invitation-password-confirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          className={adminFieldClass}
        />
      </div>
      {state.message ? (
        <p
          role={state.status === "success" ? "status" : "alert"}
          className={`rounded-[var(--radius-rounded)] border p-3 text-sm ${
            state.status === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={adminPrimaryButtonClass}>
        {pending ? "Création en cours…" : "Créer mon compte"}
      </button>
    </form>
  );
}
