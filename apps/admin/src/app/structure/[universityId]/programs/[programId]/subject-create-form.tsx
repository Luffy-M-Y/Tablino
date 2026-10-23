"use client";

import { useEffect, useRef, useState } from "react";
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
  const [selectedAcademicYearLabel, setSelectedAcademicYearLabel] = useState("");
  const academicYearInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const match = /^(\d{4})-(\d{4})$/.exec(academicYearLabel);
    const invalidSequence = match && Number(match[2]) !== Number(match[1]) + 1;
    academicYearInputRef.current?.setCustomValidity(
      invalidSequence ? "La seconde année doit suivre la première." : "",
    );
  }, [academicYearLabel]);

  function handleAcademicYearInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const formatted = digits.length > 4
      ? `${digits.slice(0, 4)}-${digits.slice(4)}`
      : digits;
    setSelectedAcademicYearLabel("");
    setAcademicYearLabel(formatted);
  }

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
          <label htmlFor={`subject-academic-year-label-${programId}`} className="mb-2 block">
            Année académique
          </label>
          <div className="flex gap-2">
            <select
              aria-label="Choisir une année académique existante"
              className={fieldClassName}
              value={selectedAcademicYearLabel}
              disabled={Boolean(academicYearLabel && !selectedAcademicYearLabel)}
              onChange={(event) => {
                const label = event.target.value;
                setSelectedAcademicYearLabel(label);
                setAcademicYearLabel(label);
              }}
            >
              <option value="">Saisie manuelle</option>
              {academicYears.map((academicYear) => (
                <option key={academicYear.id} value={academicYear.label}>
                  {academicYear.label}
                </option>
              ))}
            </select>
            <input
              ref={academicYearInputRef}
              id={`subject-academic-year-label-${programId}`}
              name="academicYearLabel"
              type="text"
              maxLength={9}
              pattern="\d{4}-\d{4}"
              inputMode="numeric"
              placeholder="2025-2026"
              className={fieldClassName}
              value={academicYearLabel}
              readOnly={Boolean(selectedAcademicYearLabel)}
              onChange={(event) => handleAcademicYearInput(event.target.value)}
              required
            />
          </div>
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
