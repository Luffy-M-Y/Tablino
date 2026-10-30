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

  function buildTitledPdfName(title: string): string {
    const cleaned: string[] = [];
    let current = "";
    for (let index = 0; index < title.length; index += 1) {
      const code = title.charCodeAt(index);
      if (code <= 32) {
        if (current) {
          current += " ";
        }
        continue;
      }
      if (code === 47 || code === 92 || code === 58 || code === 42 || code === 63 || code === 34 || code === 60 || code === 62 || code === 124) {
        if (current) {
          current += " ";
        }
        continue;
      }
      if (code === 58 || code === 92 || code === 47 || code === 42 || code === 63 || code === 34 || code === 60 || code === 62 || code === 124) {
        if (current) {
          current += " ";
        }
        continue;
      }
      current += title[index];
    }
    const trimmed = current.trim();
    const parts: string[] = [];
    let buffer = "";
    for (let index = 0; index < trimmed.length; index += 1) {
      const code = trimmed.charCodeAt(index);
      if (code === 32) {
        if (buffer) {
          parts.push(buffer);
          buffer = "";
        }
        continue;
      }
      buffer += trimmed[index];
    }
    if (buffer) parts.push(buffer);
    const compact = parts.join(" ");
    const finalName = compact.length > 100 ? compact.slice(0, 100) : compact;
    return finalName ? finalName + ".pdf" : "scan.pdf";
  }

  const scanAction: StructureFormAction = async (previousState, formData) => {
    if (pdfFileRef.current === null) {
      return { ok: false, reason: "invalid_file", message: "Créez d'abord le PDF." };
    }

    const title = String(formData.get("title") ?? "").trim();
    if (title.length === 0) {
      return { ok: false, reason: "invalid_file", message: "Le titre est obligatoire." };
    }

    const renamedPdf = new File([pdfFileRef.current], buildTitledPdfName(title), { type: "application/pdf" });
    formData.set("file", renamedPdf);
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
      titleRequired
    >
      <div className="basis-full">
        <ScanPages
          key={resetKey}
          onPdfChange={(file) => {
            pdfFileRef.current = file;
          }}
        />
      </div>
    </DocumentForm>
  );
}
