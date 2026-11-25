"use client";

import { useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { ACCEPTED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES, detectUploadFile } from "@tablino/storage/file-signature";
import { adminSecondaryButtonClass } from "@/components/admin-ui";
import { DocumentForm, type Cycle, type Program } from "./document-form";

const UNSUPPORTED_FILE_MESSAGE =
  "Format refusé : fichiers acceptés : PDF, Word, Excel, PowerPoint, LibreOffice, texte, CSV, JPG, PNG, MP4 et MP3.";
const TOO_LARGE_MESSAGE = "Le fichier dépasse 20 Mo.";
const EMPTY_FILE_MESSAGE = "Le fichier est vide. Choisissez un fichier qui contient des données.";
const CHECKING_MESSAGE = "Vérification du fichier en cours…";

type FileCheck = { status: "idle" | "checking" | "ok" } | { status: "error"; message: string };

type Props = {
  universityId: string;
  programs: Program[];
  cycles: Cycle[];
};

export function UploadForm({ universityId, programs, cycles }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileCheck, setFileCheck] = useState<FileCheck>({ status: "idle" });
  const checkIdRef = useRef(0);

  function clearFile() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    checkIdRef.current += 1;
    setSelectedFile(null);
    setFileCheck({ status: "idle" });
  }

  // Même contrôle que le serveur (extension + signature), pour refuser dès l'étape « Fichier ».
  async function checkFile(file: File | null) {
    const checkId = ++checkIdRef.current;
    setSelectedFile(file);
    if (file === null) {
      setFileCheck({ status: "idle" });
      return;
    }
    if (file.size === 0) {
      setFileCheck({ status: "error", message: EMPTY_FILE_MESSAGE });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileCheck({ status: "error", message: TOO_LARGE_MESSAGE });
      return;
    }
    setFileCheck({ status: "checking" });
    let next: FileCheck;
    try {
      const detected = detectUploadFile(file.name, new Uint8Array(await file.arrayBuffer()));
      next = detected.ok ? { status: "ok" } : { status: "error", message: UNSUPPORTED_FILE_MESSAGE };
    } catch {
      next = { status: "error", message: UNSUPPORTED_FILE_MESSAGE };
    }
    if (checkId === checkIdRef.current) setFileCheck(next);
  }

  return (
    <DocumentForm
      universityId={universityId}
      programs={programs}
      cycles={cycles}
      onProgramChange={clearFile}
      validateFileStep={() => {
        if (fileCheck.status === "checking") return CHECKING_MESSAGE;
        if (fileCheck.status === "error") return fileCheck.message;
        return null;
      }}
    >
      <div className="basis-full">
        <div className="group relative flex min-h-36 items-center justify-center rounded-xl border-2 border-dashed border-[color:var(--admin-card-border)] bg-[color:var(--admin-page-background)] px-4 py-6 text-center transition-colors hover:border-[color:var(--admin-action)] hover:bg-[color:var(--admin-action-soft)] focus-within:border-[color:var(--admin-action)] focus-within:bg-[color:var(--admin-action-soft)] motion-reduce:transition-none">
          <input
            id="upload-file"
            ref={fileInputRef}
            name="file"
            type="file"
            accept={ACCEPTED_UPLOAD_EXTENSIONS}
            className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
            aria-labelledby="upload-file-label"
            aria-describedby="upload-file-prompt"
            onChange={(event) => void checkFile(event.currentTarget.files?.[0] ?? null)}
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
            <span className="text-xs text-[color:var(--color-muted-foreground)]">
              PDF, Word, Excel, PowerPoint, LibreOffice, texte, CSV, JPG, PNG, MP4 ou MP3, 20 Mo au plus
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
              onClick={clearFile}
            >
              Retirer
            </button>
          </div>
        ) : null}
        {fileCheck.status === "error" ? (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {fileCheck.message}
          </p>
        ) : null}
      </div>
    </DocumentForm>
  );
}
