"use client";

import { useState, type ReactNode } from "react";
import { BookOpen, ClipboardList } from "lucide-react";
import { StructureActionForm } from "../structure/[universityId]/structure-action-form";
import { uploadFileAction } from "../structure/[universityId]/actions";
import type { StructureFormAction } from "@/lib/structure-action-utils.mjs";
import {
  AdminCard,
  adminFieldClass,
  adminLabelClass,
} from "@/components/admin-ui";

export type Program = {
  id: string;
  name: string;
};

export type Subject = {
  id: string;
  name: string;
  academicYearLabel: string;
};

export type Level = {
  id: string;
  name: string;
  yearNumber: number;
  programId: string;
  subjects: Subject[];
};

export type Cycle = {
  id: string;
  name: string;
  order: number;
  levels: Level[];
};

type Props = {
  universityId: string;
  programs: Program[];
  cycles: Cycle[];
  action?: StructureFormAction;
  buttonLabel?: string;
  onProgramChange?: () => void;
  titleRequired?: boolean;
  children: ReactNode;
};

export const fieldClassName = adminFieldClass;

export function DocumentForm({
  universityId,
  programs,
  cycles,
  action = uploadFileAction,
  buttonLabel = "Envoyer le fichier",
  onProgramChange,
  titleRequired = false,
  children,
}: Props) {
  const [kind, setKind] = useState<"resource" | "assignment">("resource");
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [academicYearLabel, setAcademicYearLabel] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const levels = cycles
    .flatMap((cycle) => cycle.levels
      .filter((level) => level.programId === programId)
      .map((level) => ({ ...level, cycleOrder: cycle.order, cycleName: cycle.name })))
    .sort((a, b) => a.cycleOrder - b.cycleOrder || a.yearNumber - b.yearNumber);
  const selectedLevel = levels.find((level) => level.id === levelId);
  const academicYearLabels = [...new Set(
    selectedLevel?.subjects.map((subject) => subject.academicYearLabel) ?? [],
  )];
  const subjects = selectedLevel?.subjects.filter(
    (subject) => subject.academicYearLabel === academicYearLabel,
  ) ?? [];
  const hasNoSubjects = Boolean(levelId)
    && (academicYearLabels.length === 0 || (Boolean(academicYearLabel) && subjects.length === 0));
  const isUploadLayout = !titleRequired;
  const uploadFieldClassName = `${fieldClassName} h-11 text-sm`;
  const typeControl = isUploadLayout ? (
    <fieldset>
      <legend className={`${adminLabelClass} mb-2`}>Type</legend>
      <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-page-background)] p-1 md:max-w-xs">
        <label className="cursor-pointer">
          <input
            id="upload-kind"
            type="radio"
            name="kind"
            value="resource"
            checked={kind === "resource"}
            onChange={() => setKind("resource")}
            required
            className="peer sr-only"
          />
          <span className="flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[color:var(--color-text)] transition-[color,background-color,box-shadow] duration-200 hover:bg-white/70 hover:text-[color:var(--color-primary-text)] peer-checked:bg-[color:var(--color-primary)] peer-checked:text-white peer-checked:shadow-sm peer-checked:hover:bg-[color:var(--color-primary)] peer-checked:hover:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--color-ring)] motion-reduce:transition-none">
            <BookOpen size={18} aria-hidden="true" />
            Cours
          </span>
        </label>
        <label className="cursor-pointer">
          <input
            id="upload-kind-assignment"
            type="radio"
            name="kind"
            value="assignment"
            checked={kind === "assignment"}
            onChange={() => setKind("assignment")}
            required
            className="peer sr-only"
          />
          <span className="flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[color:var(--color-text)] transition-[color,background-color,box-shadow] duration-200 hover:bg-white/70 hover:text-[color:var(--color-primary-text)] peer-checked:bg-[color:var(--color-primary)] peer-checked:text-white peer-checked:shadow-sm peer-checked:hover:bg-[color:var(--color-primary)] peer-checked:hover:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--color-ring)] motion-reduce:transition-none">
            <ClipboardList size={18} aria-hidden="true" />
            Devoir
          </span>
        </label>
      </div>
    </fieldset>
  ) : (
    <div>
      <label htmlFor="upload-kind" className="mb-2 block">
        Type
      </label>
      <select
        id="upload-kind"
        name="kind"
        className={fieldClassName}
        value={kind}
        onChange={(event) =>
          setKind(event.target.value === "assignment" ? "assignment" : "resource")}
        required
      >
        <option value="resource">Cours</option>
        <option value="assignment">Devoir</option>
      </select>
    </div>
  );
  const structureControls = (
    <div className={isUploadLayout ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "contents"}>
      <div>
        <label htmlFor="upload-program" className={isUploadLayout ? adminLabelClass : "mb-2 block"}>
          Filière
        </label>
        <select
          id="upload-program"
          className={isUploadLayout ? uploadFieldClassName : fieldClassName}
          value={programId}
          onChange={(event) => {
            setProgramId(event.target.value);
            setLevelId("");
            setAcademicYearLabel("");
            setSubjectId("");
            onProgramChange?.();
          }}
          required
        >
          <option value="">Choisir une filière</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="upload-level" className={isUploadLayout ? adminLabelClass : "mb-2 block"}>
          Niveau
        </label>
        <select
          id="upload-level"
          className={isUploadLayout ? uploadFieldClassName : fieldClassName}
          value={levelId}
          onChange={(event) => {
            setLevelId(event.target.value);
            setAcademicYearLabel("");
            setSubjectId("");
          }}
          disabled={!programId}
          required
        >
          <option value="">Choisir un niveau</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name} ({level.cycleName})
            </option>
          ))}
        </select>
        {isUploadLayout && !programId ? (
          <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">Choisis d’abord une filière.</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="upload-academic-year" className={isUploadLayout ? adminLabelClass : "mb-2 block"}>
          Année académique
        </label>
        <select
          id="upload-academic-year"
          className={isUploadLayout ? uploadFieldClassName : fieldClassName}
          value={academicYearLabel}
          onChange={(event) => {
            setAcademicYearLabel(event.target.value);
            setSubjectId("");
          }}
          disabled={!levelId || academicYearLabels.length === 0}
          required
        >
          <option value="">Choisir une année académique</option>
          {academicYearLabels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        {isUploadLayout && !levelId ? (
          <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">Choisis d’abord un niveau.</p>
        ) : isUploadLayout && academicYearLabels.length === 0 ? (
          <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">Aucune année académique disponible pour ce niveau.</p>
        ) : null}
      </div>
      <div>
        <label htmlFor="upload-subject" className={isUploadLayout ? adminLabelClass : "mb-2 block"}>
          Matière
        </label>
        {hasNoSubjects && <p>Aucune matière. Ajoutez d'abord une matière.</p>}
        <select
          id="upload-subject"
          className={isUploadLayout ? uploadFieldClassName : fieldClassName}
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          disabled={!levelId || academicYearLabels.length === 0}
          required
        >
          <option value="">Choisir une matière</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        {isUploadLayout && !levelId ? (
          <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">Choisis d’abord un niveau.</p>
        ) : isUploadLayout && academicYearLabels.length === 0 ? (
          <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">Aucune année académique disponible.</p>
        ) : null}
      </div>
    </div>
  );
  const publicationControls = (
    <>
      <div>
        <label htmlFor="upload-title" className={isUploadLayout ? adminLabelClass : "mb-2 block"}>
          {titleRequired ? "Titre" : "Titre (facultatif)"}
        </label>
        <input
          id="upload-title"
          name="title"
          type="text"
          maxLength={255}
          className={isUploadLayout ? uploadFieldClassName : fieldClassName}
          required={titleRequired}
        />
        {!titleRequired && <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">Sans titre, le nom du fichier est utilisé.</p>}
      </div>
      {isUploadLayout ? (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-[color:var(--admin-page-background)] p-4">
          <div>
            <label htmlFor="upload-publish-now" className="text-sm font-semibold text-[color:var(--color-text)]">
              Publier directement
            </label>
            <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">Sans cocher, le fichier reste en brouillon.</p>
          </div>
          <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
            <input
              type="checkbox"
              id="upload-publish-now"
              name="publishNow"
              className="peer sr-only"
            />
            <span aria-hidden="true" className="absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-[color:var(--color-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--color-ring)] motion-reduce:transition-none" />
            <span aria-hidden="true" className="pointer-events-none absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 motion-reduce:transition-none" />
          </span>
        </div>
      ) : (
        <div>
          <input type="checkbox" id="upload-publish-now" name="publishNow" />
          <label htmlFor="upload-publish-now">Publier directement</label>
          <p className="text-sm">Sans cocher, le fichier reste en brouillon.</p>
        </div>
      )}
    </>
  );

  return (
    isUploadLayout ? (
      <AdminCard className="!p-0">
        <StructureActionForm action={action} buttonLabel={buttonLabel}>
          <input type="hidden" name="universityId" value={universityId} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <section aria-labelledby="upload-destination-heading" className="space-y-5 p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-icon-background)] text-sm font-bold text-[color:var(--admin-icon-color)]">1</span>
              <div className="min-w-0">
                <h2 id="upload-destination-heading" className="font-semibold text-[color:var(--color-text)]">Destination</h2>
                <p className="text-sm text-[color:var(--color-muted-foreground)]">Choisis le type et l’emplacement du fichier.</p>
              </div>
            </div>
            {typeControl}
            {structureControls}
          </section>
          <section aria-labelledby="upload-file-heading" className="space-y-4 border-t border-[color:var(--admin-card-border)] p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-icon-background)] text-sm font-bold text-[color:var(--admin-icon-color)]">2</span>
              <div className="min-w-0">
                <h2 id="upload-file-heading" className="font-semibold text-[color:var(--color-text)]">Fichier</h2>
                <p className="text-sm text-[color:var(--color-muted-foreground)]">Ajoute le document à envoyer.</p>
              </div>
            </div>
            {children}
          </section>
          <section aria-labelledby="upload-publication-heading" className="space-y-5 border-t border-[color:var(--admin-card-border)] p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--admin-icon-background)] text-sm font-bold text-[color:var(--admin-icon-color)]">3</span>
              <div className="min-w-0">
                <h2 id="upload-publication-heading" className="font-semibold text-[color:var(--color-text)]">Publication</h2>
                <p className="text-sm text-[color:var(--color-muted-foreground)]">Complète le titre et choisis quand publier.</p>
              </div>
            </div>
            {publicationControls}
          </section>
        </StructureActionForm>
      </AdminCard>
    ) : (
      <StructureActionForm action={action} buttonLabel={buttonLabel}>
        <input type="hidden" name="universityId" value={universityId} />
        <input type="hidden" name="subjectId" value={subjectId} />
        {typeControl}
        {structureControls}
        {publicationControls}
        {children}
      </StructureActionForm>
    )
  );
}
