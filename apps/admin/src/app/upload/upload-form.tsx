"use client";

import { useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { adminSecondaryButtonClass } from "@/components/admin-ui";
import { DocumentForm, type Cycle, type Program } from "./document-form";

type Props = {
  universityId: string;
  programs: Program[];
  cycles: Cycle[];
};

export function UploadForm({ universityId, programs, cycles }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <DocumentForm
      universityId={universityId}
      programs={programs}
      cycles={cycles}
      onProgramChange={() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setSelectedFile(null);
      }}
    >
      <div className="basis-full">
        <div className="group relative flex min-h-36 items-center justify-center rounded-xl border-2 border-dashed border-[color:var(--admin-card-border)] bg-[color:var(--admin-page-background)] px-4 py-6 text-center transition-colors hover:border-[color:var(--admin-action)] hover:bg-[color:var(--admin-action-soft)] focus-within:border-[color:var(--admin-action)] focus-within:bg-[color:var(--admin-action-soft)] motion-reduce:transition-none">
          <input
            id="upload-file"
            ref={fileInputRef}
            name="file"
            type="file"
            className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
            aria-labelledby="upload-file-label"
            aria-describedby="upload-file-prompt"
            onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)}
            required
          />
          <div className="pointer-events-none flex flex-col items-center gap-2">
            <CloudUpload
              size={32}
              aria-hidden="true"
              className="text-[color:var(--admin-icon-color)] transition-transform duration-200 motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-within:-translate-y-1 motion-reduce:transition-none motion-reduce:transform-none"
            />
            <span id="upload-file-label" className="sr-only">Fichier</span>
            <span id="upload-file-prompt" className="text-sm font-medium text-[color:var(--color-text)]">
              Glisse un fichier ici ou clique pour parcourir
            </span>
          </div>
        </div>
        {selectedFile ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--admin-card-border)] bg-white p-3">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--color-text)]">
              {selectedFile.name}
              <span className="ml-2 font-normal text-[color:var(--color-muted-foreground)]">
                {selectedFile.size >= 1048576
                  ? `${(selectedFile.size / 1048576).toFixed(1)} Mo`
                  : `${Math.round(selectedFile.size / 1024)} Ko`}
              </span>
            </p>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.value = "";
                setSelectedFile(null);
              }}
            >
              Retirer
            </button>
          </div>
        ) : null}
      </div>
    </DocumentForm>
  );
}
