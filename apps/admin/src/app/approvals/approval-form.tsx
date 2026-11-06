"use client";

import { useActionState } from "react";
import { approveUniversityAction, type ApprovalActionState } from "./actions";

const initialState: ApprovalActionState = {
  status: "idle",
  message: null,
  warning: null,
  percentage: "",
};

export function ApprovalForm({
  universityId,
}: {
  universityId: string;
}) {
  const [state, formAction, pending] = useActionState(approveUniversityAction, initialState);

  if (state.status === "success") {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="font-semibold">{state.message}</p>
        {state.warning && <p className="mt-1 text-amber-700">{state.warning}</p>}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="universityId" value={universityId} />
      {state.message && state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
      <div>
        <label htmlFor={`percentage-${universityId}`} className="mb-1 block text-sm font-medium">
          Part université (%)
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`percentage-${universityId}`}
            name="percentage"
            type="text"
            required
            placeholder="Ex. 30"
            defaultValue={state.percentage ?? ""}
            key={state.percentage}
            className="w-32 rounded border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
          />
          <span className="text-sm font-medium text-slate-600">%</span>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Validation…" : "Valider"}
          </button>
        </div>
      </div>
    </form>
  );
}
