"use client";

import { createProgramAction } from "../actions";
import { StructureActionForm } from "../structure-action-form";

export function CreateProgramForm({ universityId }: { universityId: string }) {
  return (
    <StructureActionForm action={createProgramAction} buttonLabel="Ajouter la filière">
      <input type="hidden" name="universityId" value={universityId} />
      <div>
        <label htmlFor="new-program-name" className="mb-2 block">
          Nom de la filière
        </label>
        <input
          id="new-program-name"
          name="name"
          type="text"
          maxLength={255}
          required
          className="border border-[color:var(--color-border)] rounded px-3 py-2"
        />
      </div>
    </StructureActionForm>
  );
}
