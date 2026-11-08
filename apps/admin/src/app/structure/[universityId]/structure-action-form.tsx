"use client";

import { useActionState, type ReactNode } from "react";
import type { StructureFormAction } from "@/lib/structure-action-utils.mjs";
import { adminPrimaryButtonClass } from "@/components/admin-ui";

type Props = {
  action: StructureFormAction;
  buttonLabel: string;
  children: ReactNode;
};

export function StructureActionForm({ action, buttonLabel, children }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      {children}
      <button
        type="submit"
        disabled={pending}
        className={adminPrimaryButtonClass}
      >
        {pending ? "Enregistrement…" : buttonLabel}
      </button>
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          aria-live="polite"
          className={`basis-full rounded-[var(--radius-rounded)] px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
