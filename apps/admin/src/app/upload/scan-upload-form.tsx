"use client";

import { useRef, useState, startTransition } from "react";
import type { StructureFormAction } from "@/lib/structure-action-utils.mjs";
import { uploadFileAction } from "../structure/[universityId]/actions";
import { DocumentForm, type Cycle, type Program } from "./document-form";
import { ScanPages } from "./scan-pages";

type Props = {
  universityId: string;
  programs: Program[];
  cycles: Cycle[];
};

export function ScanUploadForm({ universityId, programs, cycles }: Props) {
  const pdfFileRef = useRef<File | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const scanAction: StructureFormAction = async (previousState, formData) => {
    if (pdfFileRef.current === null) {
      return { ok: false, reason: "invalid_file", message: "Créez d'abord le PDF." };
    }

    formData.set("file", pdfFileRef.current);
    const result = await uploadFileAction(previousState, formData);
    if (result.ok) {
      pdfFileRef.current = null;
      startTransition(() => setResetKey((value) => value + 1));
    }

    return result;
  };

  return (
    <DocumentForm
      universityId={universityId}
      programs={programs}
      cycles={cycles}
      action={scanAction}
      buttonLabel="Envoyer le PDF"
    >
      <ScanPages
        key={resetKey}
        onPdfChange={(file) => {
          pdfFileRef.current = file;
        }}
      />
    </DocumentForm>
  );
}
