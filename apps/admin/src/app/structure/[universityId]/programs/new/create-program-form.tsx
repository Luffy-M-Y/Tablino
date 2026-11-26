"use client";

import { createProgramAction } from "../../actions";
import { StructureActionForm } from "../../structure-action-form";
import { adminFieldClass, adminLabelClass } from "@/components/admin-ui";

export function CreateProgramForm({ universityId }: { universityId: string }) {
  return (
    <StructureActionForm
      action={createProgramAction}
      buttonLabel="Créer la filière"
      className="mt-4 grid max-w-xl gap-5"
      submitWrapperClassName="flex justify-end border-t border-[color:var(--admin-card-border)] pt-4"
    >
      <input type="hidden" name="universityId" value={universityId} />
      <div>
        <label htmlFor="new-program-name" className={adminLabelClass}>
          Nom de la filière
        </label>
        <input
          id="new-program-name"
          name="name"
          type="text"
          maxLength={255}
          required
          className={adminFieldClass}
        />
      </div>
      <label
        htmlFor="new-program-keep-draft"
        className="flex cursor-pointer items-start gap-3 rounded-xl bg-[color:var(--admin-page-background)] p-4"
      >
        <input
          id="new-program-keep-draft"
          name="keepDraft"
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-amber-500"
        />
        <span>
          <span className="block text-sm font-semibold text-[color:var(--color-text)]">Créer en brouillon</span>
          <span className="mt-1 block text-sm text-[color:var(--color-muted-foreground)]">
            Sans cocher, la filière est publiée et visible des étudiants dès qu'elle a du contenu publié.
          </span>
        </span>
      </label>
    </StructureActionForm>
  );
}
