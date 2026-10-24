"use client";

import { useState, type ReactNode } from "react";
import { StructureActionForm } from "../structure/[universityId]/structure-action-form";
import { uploadFileAction } from "../structure/[universityId]/actions";
import type { StructureFormAction } from "@/lib/structure-action-utils.mjs";

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
  children: ReactNode;
};

export const fieldClassName = "border border-[color:var(--color-border)] rounded px-3 py-2";

export function DocumentForm({
  universityId,
  programs,
  cycles,
  action = uploadFileAction,
  buttonLabel = "Envoyer le fichier",
  onProgramChange,
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

  return (
    <StructureActionForm action={action} buttonLabel={buttonLabel}>
      <input type="hidden" name="universityId" value={universityId} />
      <input type="hidden" name="subjectId" value={subjectId} />
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
      <div>
        <label htmlFor="upload-program" className="mb-2 block">
          Filière
        </label>
        <select
          id="upload-program"
          className={fieldClassName}
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
        <label htmlFor="upload-level" className="mb-2 block">
          Niveau
        </label>
        <select
          id="upload-level"
          className={fieldClassName}
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
      </div>
      <div>
        <label htmlFor="upload-academic-year" className="mb-2 block">
          Année académique
        </label>
        <select
          id="upload-academic-year"
          className={fieldClassName}
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
      </div>
      <div>
        <label htmlFor="upload-subject" className="mb-2 block">
          Matière
        </label>
        {hasNoSubjects && <p>Aucune matière. Ajoutez d'abord une matière.</p>}
        <select
          id="upload-subject"
          className={fieldClassName}
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
      </div>
      <div>
        <label htmlFor="upload-title" className="mb-2 block">
          Titre (facultatif)
        </label>
        <input
          id="upload-title"
          name="title"
          type="text"
          maxLength={255}
          className={fieldClassName}
        />
        <p className="text-sm">Sans titre, le nom du fichier est utilisé.</p>
      </div>
      {children}
    </StructureActionForm>
  );
}
