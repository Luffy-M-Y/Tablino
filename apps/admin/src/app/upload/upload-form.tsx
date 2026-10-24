"use client";

import { useRef } from "react";
import { DocumentForm, fieldClassName, type Cycle, type Program } from "./document-form";

type Props = {
  universityId: string;
  programs: Program[];
  cycles: Cycle[];
};

export function UploadForm({ universityId, programs, cycles }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <DocumentForm
      universityId={universityId}
      programs={programs}
      cycles={cycles}
      onProgramChange={() => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }}
    >
      <div>
        <label htmlFor="upload-file" className="mb-2 block">
          Fichier
        </label>
        <input
          id="upload-file"
          ref={fileInputRef}
          name="file"
          type="file"
          className={fieldClassName}
          required
        />
      </div>
    </DocumentForm>
  );
}
