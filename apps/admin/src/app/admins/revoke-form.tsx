"use client";

import { useActionState, useEffect, useState } from "react";
import {
  adminDangerButtonClass,
  adminFieldClass,
  adminLabelClass,
  adminSecondaryButtonClass,
} from "@/components/admin-ui";
import { revokeAdminAction, type RevokeAdminActionState } from "./actions";
import { PendingLabel } from "@/components/pending-label";

const initialState: RevokeAdminActionState = {
  status: "idle",
  message: null,
};

export function RevokeAdminForm({
  targetId,
  targetEmail,
}: {
  targetId: string;
  targetEmail?: string | null;
}) {
  const [state, formAction, pending] = useActionState(revokeAdminAction, initialState);
  const [isConfirming, setIsConfirming] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (state.status !== "idle") {
      setPassword("");
      if (state.status === "success") {
        setIsConfirming(false);
      }
    }
  }, [state]);

  if (!isConfirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        {state.message ? (
          <p
            role={state.status === "success" ? "status" : "alert"}
            className={`text-xs ${
              state.status === "success" ? "text-emerald-800" : "text-red-700"
            }`}
          >
            {state.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className={adminDangerButtonClass}
        >
          Révoquer
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4 text-left">
      <input type="hidden" name="targetId" value={targetId} />
      <p className="text-sm font-medium text-red-950">
        Confirmer la révocation {targetEmail ? `de ${targetEmail}` : "de ce compte"} ?
      </p>
      <div>
        <label htmlFor={`revoke-password-${targetId}`} className={adminLabelClass}>
          Mot de passe de votre compte
        </label>
        <input
          id={`revoke-password-${targetId}`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-busy={pending}
          type="submit"
          disabled={pending}
          className={adminDangerButtonClass}
        >
          <PendingLabel pending={pending} pendingText={"Révocation en cours…"}>{"Confirmer la révocation"}</PendingLabel>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setIsConfirming(false);
            setPassword("");
          }}
          className={adminSecondaryButtonClass}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
