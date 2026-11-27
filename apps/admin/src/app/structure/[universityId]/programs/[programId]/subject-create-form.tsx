"use client";

import { useEffect, useRef, useState } from "react";
import { createSubjectAction } from "../../actions";
import { StructureActionForm } from "../../structure-action-form";
import { adminFieldClass, adminLabelClass } from "@/components/admin-ui";

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
  /** Niveau présélectionné (lien « Ajouter une matière » depuis l'envoi de fichier). */
  defaultLevelId?: string;
};

export function SubjectCreateForm({
  universityId,
  programId,
  levels,
  academicYears,
  defaultLevelId,
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

  function handleAcademicYearInput(value: string, previousValue: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const isTypingForward = value.length > previousValue.length;
    const formatted = digits.length > 4
      ? `${digits.slice(0, 4)}-${digits.slice(4)}`
      : digits.length === 4 && isTypingForward
        ? `${digits}-`
        : digits;
    setSelectedAcademicYearLabel("");
    setAcademicYearLabel(formatted);
  }

  if (levels.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-muted-foreground)]">
        Ajoutez d&apos;abord un cycle à la filière : les niveaux viennent des cycles.
      </p>
    );
  }

  return (
    <StructureActionForm
      action={createSubjectAction}
      buttonLabel="Ajouter la matière"
      className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2"
      messageClassName="md:col-span-2"
      submitWrapperClassName="flex justify-end border-t border-[color:var(--admin-card-border)] pt-4 md:col-span-2"
    >
      <input type="hidden" name="universityId" value={universityId} />
      <div>
        <label htmlFor={`subject-level-${programId}`} className={adminLabelClass}>
          Niveau
        </label>
        <select
          id={`subject-level-${programId}`}
          name="levelId"
          className={adminFieldClass}
          defaultValue={defaultLevelId}
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
        <label htmlFor={`subject-name-${programId}`} className={adminLabelClass}>
          Nom de la matière
        </label>
        <input
          id={`subject-name-${programId}`}
          name="name"
          type="text"
          maxLength={255}
          placeholder="Ex. : Algorithmique"
          className={adminFieldClass}
          required
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`subject-academic-year-label-${programId}`} className={adminLabelClass}>
          Année académique
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            aria-label="Choisir une année académique existante"
            className={adminFieldClass}
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
            className={adminFieldClass}
            aria-describedby={`subject-academic-year-help-${programId}`}
            value={academicYearLabel}
            readOnly={Boolean(selectedAcademicYearLabel)}
            onChange={(event) =>
              handleAcademicYearInput(event.target.value, academicYearLabel)}
            required
          />
        </div>
        <p
          id={`subject-academic-year-help-${programId}`}
          className="mt-2 text-sm text-[color:var(--color-muted-foreground)]"
        >
          {academicYears.length === 0
            ? "Aucune année ajoutée pour le moment. Saisissez l'année : 8 chiffres, le tiret s'ajoute seul."
            : "Choisissez une année existante ou saisissez-en une : 8 chiffres, le tiret s'ajoute seul."}
        </p>
      </div>
    </StructureActionForm>
  );
}
