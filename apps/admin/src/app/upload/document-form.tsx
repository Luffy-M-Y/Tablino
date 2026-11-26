"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, ClipboardList, Plus, TriangleAlert, type LucideIcon } from "lucide-react";
import { StructureActionForm } from "../structure/[universityId]/structure-action-form";
import { uploadFileAction } from "../structure/[universityId]/actions";
import type { StructureFormAction } from "@/lib/structure-action-utils.mjs";
import {
  AdminCard,
  adminFieldClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin-ui";
import { PendingLabel } from "@/components/pending-label";

export type Program = {
  id: string;
  name: string;
  status: "draft" | "published";
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
  /** Contrôle propre à l'étape « Fichier » : message d'erreur, ou null si l'étape est valide. */
  validateFileStep?: () => string | null;
  children: ReactNode;
};

type WizardStep = 1 | 2 | 3;

const WIZARD_STEPS: ReadonlyArray<{ step: WizardStep; title: string; description: string }> = [
  { step: 1, title: "Destination", description: "Choisis le type et l’emplacement du fichier." },
  { step: 2, title: "Fichier", description: "Ajoute le document à envoyer." },
  { step: 3, title: "Publication", description: "Complète le titre ; le fichier est publié sauf si tu le gardes en brouillon." },
];

function WizardSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-busy={pending} disabled={pending} className={adminPrimaryButtonClass}>
      <PendingLabel pending={pending} pendingText={"Enregistrement…"}>{label}</PendingLabel>
    </button>
  );
}

export const fieldClassName = adminFieldClass;

const kindOptionClassName = "flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[color:var(--color-text)] transition-[color,background-color,box-shadow] duration-200 hover:bg-white/70 hover:text-[color:var(--color-primary-text)] peer-checked:bg-[color:var(--color-primary)] peer-checked:text-white peer-checked:shadow-sm peer-checked:hover:bg-[color:var(--color-primary)] peer-checked:hover:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--color-ring)] motion-reduce:transition-none";
const selectClassName = `${fieldClassName} h-11 text-sm`;
const hintClassName = "mt-1 text-xs text-[color:var(--color-muted-foreground)]";

/** Raccourci vers la page où ajouter l'élément manquant. */
function ShortcutLink({ href, children, icon: Icon = Plus }: { href: string; children: ReactNode; icon?: LucideIcon }) {
  return (
    <Link
      href={href}
      className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-3 py-1.5 text-sm font-semibold text-[color:var(--color-primary-text)] transition-colors hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-page-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)] motion-reduce:transition-none"
    >
      <Icon size={14} aria-hidden="true" />
      {children}
    </Link>
  );
}

/** Filière en brouillon : ce qui y est publié reste invisible des étudiants. */
function DraftProgramWarning({ href }: { href: string }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">Filière en brouillon</p>
        <p className="mt-1 text-sm">
          Le fichier restera invisible des étudiants tant que la filière n'est pas publiée.
        </p>
        <ShortcutLink href={href} icon={ArrowRight}>Publier la filière</ShortcutLink>
      </div>
    </div>
  );
}

export function DocumentForm({
  universityId,
  programs,
  cycles,
  action = uploadFileAction,
  buttonLabel = "Envoyer le fichier",
  onProgramChange,
  titleRequired = false,
  validateFileStep,
  children,
}: Props) {
  const [kind, setKind] = useState<"resource" | "assignment">("resource");
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [academicYearLabel, setAcademicYearLabel] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [step, setStep] = useState<WizardStep>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<WizardStep, HTMLElement | null>>({ 1: null, 2: null, 3: null });
  const headingRefs = useRef<Record<WizardStep, HTMLHeadingElement | null>>({ 1: null, 2: null, 3: null });
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!hasNavigated.current) return;
    headingRefs.current[step]?.focus();
  }, [step]);

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

  function goToStep(target: WizardStep) {
    hasNavigated.current = true;
    setStepError(null);
    setStep(target);
  }

  // Les champs natifs de l'étape d'abord, puis les contrôles que le navigateur ne voit pas
  // (matière vide quand les listes sont désactivées, PDF du scan non créé).
  function validateStep(target: WizardStep): boolean {
    const section = sectionRefs.current[target];
    if (section) {
      const controls = section.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
      for (const control of controls) {
        if (!control.checkValidity()) {
          control.reportValidity();
          return false;
        }
      }
    }
    let message: string | null = null;
    if (target === 1 && !subjectId) message = "Choisis une matière avant de continuer.";
    if (target === 2 && validateFileStep) message = validateFileStep();
    setStepError(message);
    return message === null;
  }

  function goNext() {
    if (step === 3 || !validateStep(step)) return;
    goToStep(step === 1 ? 2 : 3);
  }

  const typeControl = (
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
          <span className={kindOptionClassName}>
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
          <span className={kindOptionClassName}>
            <ClipboardList size={18} aria-hidden="true" />
            Devoir
          </span>
        </label>
      </div>
    </fieldset>
  );

  const selectedProgram = programs.find((program) => program.id === programId);
  const draftProgramWarning = selectedProgram?.status === "draft"
    ? <DraftProgramWarning href={`/structure/${universityId}/programs/${selectedProgram.id}#statut`} />
    : null;

  const structureControls = (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-4">
      <div>
        <label htmlFor="upload-program" className={adminLabelClass}>
          Filière
        </label>
        <select
          id="upload-program"
          className={selectClassName}
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
          <option value="">{programs.length === 0 ? "Aucune filière" : "Choisir une filière"}</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
        {programs.length === 0 ? (
          <>
            <p className={hintClassName}>Aucune filière pour le moment.</p>
            <ShortcutLink href={`/structure/${universityId}/programs/new`}>Créer une filière</ShortcutLink>
          </>
        ) : null}
      </div>
      <div>
        <label htmlFor="upload-level" className={adminLabelClass}>
          Niveau
        </label>
        <select
          id="upload-level"
          className={selectClassName}
          value={levelId}
          onChange={(event) => {
            setLevelId(event.target.value);
            setAcademicYearLabel("");
            setSubjectId("");
          }}
          disabled={!programId}
          required
        >
          <option value="">{programId && levels.length === 0 ? "Aucun niveau" : "Choisir un niveau"}</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name} ({level.cycleName})
            </option>
          ))}
        </select>
        {!programId ? (
          <p className={hintClassName}>Choisis d’abord une filière.</p>
        ) : levels.length === 0 ? (
          <>
            <p className={hintClassName}>Aucun niveau : ajoutez un cycle à la filière.</p>
            <ShortcutLink href={`/structure/${universityId}/programs/${programId}/edit#ajouter-cycle`}>Ajouter un cycle</ShortcutLink>
          </>
        ) : null}
      </div>
      <div>
        <label htmlFor="upload-academic-year" className={adminLabelClass}>
          Année académique
        </label>
        <select
          id="upload-academic-year"
          className={selectClassName}
          value={academicYearLabel}
          onChange={(event) => {
            setAcademicYearLabel(event.target.value);
            setSubjectId("");
          }}
          disabled={!levelId || academicYearLabels.length === 0}
          required
        >
          <option value="">{levelId && academicYearLabels.length === 0 ? "Aucune année académique" : "Choisir une année académique"}</option>
          {academicYearLabels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        {!levelId ? (
          <p className={hintClassName}>Choisis d’abord un niveau.</p>
        ) : academicYearLabels.length === 0 ? (
          <>
            <p className={hintClassName}>Aucune année pour ce niveau : elle se crée avec la première matière.</p>
            <ShortcutLink href={`/structure/${universityId}/programs/${programId}/edit?niveau=${encodeURIComponent(levelId)}#ajouter-matiere`}>Ajouter une matière</ShortcutLink>
          </>
        ) : null}
      </div>
      <div>
        <label htmlFor="upload-subject" className={adminLabelClass}>
          Matière
        </label>
        <select
          id="upload-subject"
          className={selectClassName}
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          disabled={!levelId || academicYearLabels.length === 0}
          required
        >
          <option value="">{hasNoSubjects ? "Aucune matière" : "Choisir une matière"}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        {!levelId ? (
          <p className={hintClassName}>Choisis d’abord un niveau.</p>
        ) : hasNoSubjects ? (
          <>
            <p className={hintClassName}>Aucune matière pour ce niveau et cette année.</p>
            <ShortcutLink href={`/structure/${universityId}/programs/${programId}/edit?niveau=${encodeURIComponent(levelId)}#ajouter-matiere`}>Ajouter une matière</ShortcutLink>
          </>
        ) : !academicYearLabel ? (
          <p className={hintClassName}>Choisis d’abord une année académique.</p>
        ) : null}
      </div>
    </div>
  );

  const publicationControls = (
    <>
      <div>
        <label htmlFor="upload-title" className={adminLabelClass}>
          {titleRequired ? "Titre" : "Titre (facultatif)"}
        </label>
        <input
          id="upload-title"
          name="title"
          type="text"
          maxLength={255}
          className={selectClassName}
          required={titleRequired}
        />
        {!titleRequired && <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">Sans titre, le nom du fichier est utilisé.</p>}
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-[color:var(--admin-page-background)] p-4">
        <div>
          <label htmlFor="upload-keep-draft" className="text-sm font-semibold text-[color:var(--color-text)]">
            Garder en brouillon
          </label>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">Sans cocher, le fichier est publié tout de suite.</p>
        </div>
        <label htmlFor="upload-keep-draft" className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            id="upload-keep-draft"
            name="keepDraft"
            className="peer sr-only"
          />
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-amber-500 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--color-ring)] motion-reduce:transition-none" />
          <span aria-hidden="true" className="pointer-events-none absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 motion-reduce:transition-none" />
        </label>
      </div>
    </>
  );

  const stepContent: Record<WizardStep, ReactNode> = {
    1: (
      <>
        {typeControl}
        {structureControls}
        {draftProgramWarning}
      </>
    ),
    2: children,
    3: (
      <>
        {draftProgramWarning}
        {publicationControls}
      </>
    ),
  };

  return (
    <AdminCard className="!p-0">
      <StructureActionForm
        action={action}
        buttonLabel={buttonLabel}
        hideSubmit
        className="block"
        messageClassName="mx-4 mb-4 sm:mx-6 sm:mb-6"
        onSuccess={() => goToStep(1)}
      >
        <input type="hidden" name="universityId" value={universityId} />
        <input type="hidden" name="subjectId" value={subjectId} />
        <ol aria-label="Étapes" className="flex items-center gap-2 border-b border-[color:var(--admin-card-border)] px-4 py-3 sm:px-6">
          {WIZARD_STEPS.map((item, index) => {
            const isCurrent = item.step === step;
            const isDone = item.step < step;
            return (
              <li key={item.step} aria-current={isCurrent ? "step" : undefined} className="flex min-w-0 items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden="true" className={`h-px w-6 shrink-0 sm:w-10 ${isDone || isCurrent ? "bg-[color:var(--color-primary)]" : "bg-[color:var(--admin-card-border)]"}`} />
                ) : null}
                <span
                  aria-hidden="true"
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isCurrent || isDone
                    ? "bg-[color:var(--color-primary)] text-white"
                    : "bg-[color:var(--admin-icon-background)] text-[color:var(--admin-icon-color)]"}`}
                >
                  {item.step}
                </span>
                <span className={`hidden truncate text-sm sm:inline ${isCurrent ? "font-semibold text-[color:var(--color-text)]" : "text-[color:var(--color-muted-foreground)]"}`}>
                  {item.title}
                </span>
                <span className="sr-only">{`Étape ${item.step} : ${item.title}${isDone ? ", terminée" : isCurrent ? ", en cours" : ""}`}</span>
              </li>
            );
          })}
        </ol>
        {/* Un champ invalide d'une étape masquée ramène à cette étape lors de l'envoi. */}
        <div
          onInvalidCapture={(event) => {
            const owner = (event.target as HTMLElement).closest<HTMLElement>("[data-wizard-step]");
            const owningStep = Number(owner?.dataset.wizardStep);
            if (owningStep === 1 || owningStep === 2) {
              if (owningStep < step) goToStep(owningStep);
            }
          }}
        >
          {WIZARD_STEPS.map((item) => (
            <section
              key={item.step}
              ref={(element) => { sectionRefs.current[item.step] = element; }}
              data-wizard-step={item.step}
              hidden={item.step !== step}
              aria-labelledby={`upload-step-${item.step}-heading`}
              className="space-y-4 px-4 py-4 sm:px-6"
            >
              <h2
                id={`upload-step-${item.step}-heading`}
                ref={(element) => { headingRefs.current[item.step] = element; }}
                tabIndex={-1}
                className="sr-only"
              >
                {`Étape ${item.step} : ${item.title}. ${item.description}`}
              </h2>
              {stepContent[item.step]}
            </section>
          ))}
        </div>
        {stepError ? (
          <p role="alert" className="mx-4 mb-4 rounded-[var(--radius-rounded)] bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-6">
            {stepError}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-[color:var(--admin-card-border)] px-4 py-3 sm:px-6">
          {step > 1 ? (
            <button type="button" className={adminSecondaryButtonClass} onClick={() => goToStep(step === 3 ? 2 : 1)}>
              <ArrowLeft size={16} aria-hidden="true" />
              Précédent
            </button>
          ) : <span />}
          {step < 3 ? (
            <button type="button" className={adminPrimaryButtonClass} onClick={goNext}>
              Suivant
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <WizardSubmitButton label={buttonLabel} />
          )}
        </div>
      </StructureActionForm>
    </AdminCard>
  );
}
