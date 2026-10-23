"use client";

import { useState } from "react";
import { createSubjectAction } from "../../actions";
import { StructureActionForm } from "../../structure-action-form";

type ProgramLevel = {
  id: string;
  name: string;
  cycleName: string;
};

type AcademicYear = {
  id: string;
  label: string;
};

type Props = {
  universityId: string;
  programId: string;
  levels: ProgramLevel[];
  academicYears: AcademicYear[];
};

const fieldClassName = "border border-[color:var(--color-border)] rounded px-3 py-2";

export function SubjectCreateForm({
  universityId,
  programId,
  levels,
  academicYears,
}: Props) {
  const [academicYearLabel, setAcademicYearLabel] = useState("");

  if (levels.length === 0) {
    return (
      <>
        <p>Ajoutez d'abord un cycle à la filière.</p>
        {academicYears.length === 0 && <p>Aucune année académique.</p>}
      </>
    );
  }

  return (
    <>
      {academicYears.length === 0 && <p>Aucune année académique.</p>}
      <StructureActionForm action={createSubjectAction} buttonLabel="Ajouter la matière">
        <input type="hidden" name="universityId" value={universityId} />
        <div>
          <label htmlFor={`subject-level-${programId}`} className="mb-2 block">
            Niveau
          </label>
          <select
            id={`subject-level-${programId}`}
            name="levelId"
            className={fieldClassName}
            required
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name} ({level.cycleName})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`subject-academic-year-${programId}`} className="mb-2 block">
            Année académique
          </label>
          <select
            id={`subject-academic-year-${programId}`}
            name="academicYearId"
            className={fieldClassName}
            required={!academicYearLabel.trim()}
          >
            <option value="">Sélectionner une année</option>
            {academicYears.map((academicYear) => (
              <option key={academicYear.id} value={academicYear.id}>
                {academicYear.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`subject-academic-year-label-${programId}`} className="mb-2 block">
            Autre année (ex. 2025-2026)
          </label>
          <input
            id={`subject-academic-year-label-${programId}`}
            name="academicYearLabel"
            type="text"
            maxLength={20}
            className={fieldClassName}
            value={academicYearLabel}
            onChange={(event) => setAcademicYearLabel(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`subject-name-${programId}`} className="mb-2 block">
            Nom de la matière
          </label>
          <input
            id={`subject-name-${programId}`}
            name="name"
            type="text"
            maxLength={255}
            className={fieldClassName}
            required
          />
        </div>
      </StructureActionForm>
    </>
  );
}
