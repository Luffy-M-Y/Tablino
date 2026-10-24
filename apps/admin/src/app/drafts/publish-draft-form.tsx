"use client";

import { StructureActionForm } from "../structure/[universityId]/structure-action-form";
import { publishDraftAction } from "../structure/[universityId]/actions";

type Props = {
  universityId: string;
  kind: "resource" | "assignment";
  id: string;
};

export function PublishDraftForm({ universityId, kind, id }: Props) {
  return (
    <StructureActionForm action={publishDraftAction} buttonLabel="Publier">
      <input type="hidden" name="universityId" value={universityId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
    </StructureActionForm>
  );
}
