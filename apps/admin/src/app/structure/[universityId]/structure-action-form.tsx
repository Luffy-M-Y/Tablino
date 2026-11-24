"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { StructureFormAction } from "@/lib/structure-action-utils.mjs";
import { adminPrimaryButtonClass } from "@/components/admin-ui";

type Props = {
  action: StructureFormAction;
  buttonLabel: string;
  children: ReactNode;
  /** Remplace la mise en page par défaut du formulaire. */
  className?: string;
  /** Le formulaire fournit son propre bouton d'envoi (assistant en étapes). */
  hideSubmit?: boolean;
  messageClassName?: string;
  onSuccess?: () => void;
};

export function StructureActionForm({
  action,
  buttonLabel,
  children,
  className = "mt-4 flex flex-wrap items-end gap-3",
  hideSubmit = false,
  messageClassName = "",
  onSuccess,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (state?.ok) onSuccessRef.current?.();
  }, [state]);

  return (
    <form action={formAction} className={className}>
      {children}
      {hideSubmit ? null : (
        <button
          type="submit"
          disabled={pending}
          className={adminPrimaryButtonClass}
        >
          {pending ? "Enregistrement…" : buttonLabel}
        </button>
      )}
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          aria-live="polite"
          className={`basis-full rounded-[var(--radius-rounded)] px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"} ${messageClassName}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
