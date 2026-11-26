"use client";

import { StructureActionForm } from "../structure/[universityId]/structure-action-form";
import { updateProgramStatusAction } from "../structure/[universityId]/actions";
import type { StructureFormAction } from "@/lib/structure-action-utils.mjs";

type Props = {
  universityId: string;
  programId: string;
  onPublished: () => void;
};

/** Publie une filière en brouillon depuis sa carte. */
export function PublishProgramForm({ universityId, programId, onPublished }: Props) {
  // Prévient la liste dès la réponse : la carte disparaît avec la mise à jour de la page.
  const publishAction: StructureFormAction = async (previousState, formData) => {
    const result = await updateProgramStatusAction(previousState, formData);
    if (result.ok) onPublished();
    return result;
  };

  return (
    <StructureActionForm
      action={publishAction}
      buttonLabel="Publier"
      pendingText="Publication…"
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <input type="hidden" name="universityId" value={universityId} />
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="status" value="published" />
    </StructureActionForm>
  );
}
