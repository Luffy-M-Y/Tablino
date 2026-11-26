"use client";

import { useActionState, useState } from "react";
import {
  adminFieldClass,
  adminLabelClass,
  adminPrimaryButtonClass,
} from "@/components/admin-ui";
import {
  inviteAdminAction,
  type InviteAdminActionState,
} from "./actions";
import { PendingLabel } from "@/components/pending-label";

const initialState: InviteAdminActionState = {
  status: "idle",
  message: null,
};

type InvitationRoleOption = {
  value: "super_admin_editor" | "super_admin_lector";
  label: string;
};

export function InvitationForm({ roles }: { roles: InvitationRoleOption[] }) {
  const [state, formAction, pending] = useActionState(inviteAdminAction, initialState);
  const [role, setRole] = useState(roles[roles.length - 1]?.value ?? "");
  const canInviteEditor = role === "super_admin_editor";

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="invited-admin-role" className={adminLabelClass}>
          Rôle
        </label>
        <select
          id="invited-admin-role"
          name="role"
          value={role}
          onChange={(event) => {
            const selectedRole = roles.find((option) => option.value === event.target.value);
            if (selectedRole) setRole(selectedRole.value);
          }}
          required
          className={adminFieldClass}
        >
          {roles.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
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
      {canInviteEditor ? (
        <div>
          <label htmlFor="inviter-password" className={adminLabelClass}>
            Mot de passe de votre compte
          </label>
          <input
            id="inviter-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={adminFieldClass}
          />
        </div>
      ) : null}
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
        <PendingLabel pending={pending} pendingText={"Envoi en cours…"}>{"Envoyer l'invitation"}</PendingLabel>
      </button>
    </form>
  );
}
