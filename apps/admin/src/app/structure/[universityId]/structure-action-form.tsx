"use client";

import { useActionState, type ReactNode } from "react";
import type { StructureFormAction } from "@/lib/structure-action-utils.mjs";

type Props = {
  action: StructureFormAction;
  buttonLabel: string;
  children: ReactNode;
};

export function StructureActionForm({ action, buttonLabel, children }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction}>
      {children}
      <button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : buttonLabel}
      </button>
      {state && (
        <p role={state.ok ? "status" : "alert"} aria-live="polite">
          {state.message}
        </p>
      )}
    </form>
  );
}
