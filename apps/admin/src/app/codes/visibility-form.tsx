"use client";

import { startTransition, useActionState, useState } from "react";
import { AdminCard, adminLabelClass, adminPrimaryButtonClass } from "@/components/admin-ui";
import { setVisibilityAction, type VisibilityState } from "./actions";
import { PendingLabel } from "@/components/pending-label";

const initialState: VisibilityState = { status: "idle", message: null };

const choiceClass =
  "mt-1 h-4 w-4 rounded border-[color:var(--color-input-border)] text-[color:var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

export function VisibilityForm({ currentVisibility }: { currentVisibility: "private" | "public" }) {
  const [state, formAction, pending] = useActionState(setVisibilityAction, initialState);
  const [visibility, setVisibility] = useState(currentVisibility);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const revokesCodes = currentVisibility === "public" && visibility === "private";

  const isSubmitDisabled =
    pending
    || visibility === currentVisibility
    || (revokesCodes && !confirmRevoke);

  return (
    <AdminCard className="!p-4">
      <form
        onSubmit={(event) => {
          // Envoi sans l'attribut action : React 19 ne réinitialise pas le
          // formulaire, le choix reste après une erreur.
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="space-y-3"
      >
        <p className={adminLabelClass}>Visibilit&eacute; de l&apos;universit&eacute;</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="visibility"
            value="private"
            checked={visibility === "private"}
            onChange={() => setVisibility("private")}
            className={choiceClass}
          />
          <span className="text-sm text-[color:var(--color-text)]">
            Priv&eacute;e : un code d&apos;acc&egrave;s est exig&eacute; &agrave; l&apos;inscription.
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="visibility"
            value="public"
            checked={visibility === "public"}
            onChange={() => {
              setVisibility("public");
              setConfirmRevoke(false);
            }}
            className={choiceClass}
          />
          <span className="text-sm text-[color:var(--color-text)]">
            Publique : compte &eacute;tudiant obligatoire, sans code d&apos;acc&egrave;s.
          </span>
        </label>
        {revokesCodes && (
          <label className="flex items-start gap-3 cursor-pointer rounded-[var(--radius-rounded)] border border-red-200 bg-red-50 p-3">
            <input
              type="checkbox"
              name="confirmRevoke"
              checked={confirmRevoke}
              onChange={(event) => setConfirmRevoke(event.target.checked)}
              className={choiceClass}
            />
            <span className="text-sm text-red-800">
              Je comprends que tous les codes d&apos;acc&egrave;s actifs seront r&eacute;voqu&eacute;s. Les comptes
              &eacute;tudiants existants sont conserv&eacute;s ; les nouveaux &eacute;tudiants devront utiliser un nouveau code.
            </span>
          </label>
        )}
        {state.message !== null && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={state.status === "error" ? "text-sm font-medium text-red-700" : "text-sm text-[color:var(--color-text)]"}
          >
            {state.message}
          </p>
        )}
        <button type="submit" disabled={isSubmitDisabled} className={adminPrimaryButtonClass}>
          <PendingLabel pending={pending} pendingText={"Enregistrement…"}>{"Enregistrer la visibilité"}</PendingLabel>
        </button>
      </form>
    </AdminCard>
  );
}
