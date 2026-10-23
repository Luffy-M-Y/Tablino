"use client";

import { useActionState, useEffect, useId, useState } from "react";
import type { StructureFormAction } from "@/lib/structure-action-utils.mjs";

type RenameControlProps = {
  action: StructureFormAction;
  universityId: string;
  idField: "programId" | "cycleId" | "subjectId";
  idValue: string;
  currentName: string;
  maxLength: number;
  label: string;
  helpText?: string;
};

export function RenameControl({
  action,
  universityId,
  idField,
  idValue,
  currentName,
  maxLength,
  label,
  helpText,
}: RenameControlProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const [isEditing, setIsEditing] = useState(false);
  const inputId = useId();

  useEffect(() => {
    if (state?.ok) setIsEditing(false);
  }, [state]);

  return (
    <div>
      <button
        type="button"
        aria-label={label}
        aria-expanded={isEditing}
        onClick={() => setIsEditing(true)}
        className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-2 text-[color:var(--color-university-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
          <path d="m16 5 3 3M4 20l4.5-1 10-10a2.12 2.12 0 0 0-3-3l-10 10L4 20Z" />
        </svg>
      </button>
      {isEditing && (
        <form
          action={formAction}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsEditing(false);
          }}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="universityId" value={universityId} />
          <input type="hidden" name={idField} value={idValue} />
          <div>
            <label htmlFor={inputId}>{label}</label>
            <input
              id={inputId}
              name="name"
              type="text"
              defaultValue={currentName}
              maxLength={maxLength}
              required
              className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2"
            />
            {helpText && <p className="text-sm">{helpText}</p>}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-2 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setIsEditing(false)}
            className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Annuler
          </button>
        </form>
      )}
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          aria-live="polite"
          className={`mt-2 rounded-[var(--radius-rounded)] px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

type DeleteControlProps = {
  action: StructureFormAction;
  universityId: string;
  fields: Record<string, string>;
  itemName: string;
  label: string;
};

export function DeleteControl({
  action,
  universityId,
  fields,
  itemName,
  label,
}: DeleteControlProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (state?.ok) setIsConfirming(false);
  }, [state]);

  return (
    <div>
      <button
        type="button"
        aria-label={label}
        onClick={() => setIsConfirming(true)}
        className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-2 text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
          <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
        </svg>
      </button>
      {isConfirming && (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="universityId" value={universityId} />
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="confirm" value="supprimer" />
          <p>Supprimer « {itemName} » ? Cette action est définitive.</p>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[var(--radius-rounded)] bg-red-700 px-4 py-2 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Suppression…" : "Confirmer"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setIsConfirming(false)}
            className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Annuler
          </button>
        </form>
      )}
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          aria-live="polite"
          className={`mt-2 rounded-[var(--radius-rounded)] px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
