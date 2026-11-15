"use client";

import { useActionState } from "react";
import {
  adminFieldClass,
  adminLabelClass,
  adminPrimaryButtonClass,
} from "@/components/admin-ui";
import {
  inviteAdminAction,
  type InviteAdminActionState,
} from "./actions";

const initialState: InviteAdminActionState = {
  status: "idle",
  message: null,
};

export function InvitationForm() {
  const [state, formAction, pending] = useActionState(inviteAdminAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="invited-admin-email" className={adminLabelClass}>
          Adresse e-mail
        </label>
        <input
          id="invited-admin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={255}
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
        {pending ? "Envoi en cours…" : "Envoyer l'invitation"}
      </button>
    </form>
  );
}
