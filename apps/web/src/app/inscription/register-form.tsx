"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import {
  errorClass,
  inputClass,
  labelClass,
  mutedClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/kit";
import { TurnstileField } from "@/components/auth/TurnstileField";
import {
  findFirstInvalidRegisterStep,
  getRegisterSteps,
  validateRegisterStep,
  type RegisterStepId,
} from "@/lib/register-steps.mjs";
import { registerAction } from "./actions";
import { PendingLabel } from "@/components/ui/PendingLabel";

const editButtonClass =
  "text-sm font-semibold text-[color:var(--color-primary-text)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

export function RegisterForm({ requiresAccessCode }: { requiresAccessCode: boolean }) {
  const [state, action, pending] = useActionState(registerAction, { message: null });
  const steps = getRegisterSteps(requiresAccessCode);
  const [step, setStep] = useState<RegisterStepId>("identity");
  const [stepError, setStepError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);
  const values = { firstName, lastName, email, password, passwordConfirmation, accessCode };
  const stepIndex = Math.max(0, steps.findIndex((item) => item.id === step));
  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.redirectTo]);

  // Focus sur le titre de l'étape après chaque changement (lecteurs d'écran, clavier).
  useEffect(() => {
    if (hasNavigated.current) headingRef.current?.focus();
  }, [step]);

  function goTo(target: RegisterStepId) {
    hasNavigated.current = true;
    setStepError(null);
    if (target !== "review") setTurnstileToken("");
    setStep(target);
  }

  function goNext() {
    const error = validateRegisterStep(currentStep.id, values);
    if (error !== null) {
      setStepError(error);
      return;
    }
    goTo(steps[stepIndex + 1].id);
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        // Envoi sans l'attribut action : React 19 ne réinitialise pas le
        // formulaire, les champs restent après une erreur.
        event.preventDefault();
        if (currentStep.id !== "review") {
          goNext();
          return;
        }
        const invalid = findFirstInvalidRegisterStep(steps, values);
        if (invalid !== null) {
          goTo(invalid.step);
          setStepError(invalid.error);
          return;
        }
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
      className="space-y-5"
    >
      <ol
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        aria-label="Étapes de l'inscription"
      >
        {steps.map((item, index) => {
          const isCurrent = index === stepIndex;
          return (
            <li key={item.id} aria-current={isCurrent ? "step" : undefined} className="text-center">
              <span
                aria-hidden="true"
                className={`block h-1.5 rounded-full ${
                  index <= stepIndex ? "bg-[color:var(--color-primary)]" : "bg-[color:var(--color-border)]"
                }`}
              />
              <span
                className={`mt-1 block text-xs ${
                  isCurrent ? "font-semibold text-[color:var(--color-text)]" : mutedClass
                }`}
              >
                {item.title}
              </span>
            </li>
          );
        })}
      </ol>

      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>
          &Eacute;tape {stepIndex + 1} sur {steps.length}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold text-[color:var(--color-text)] focus:outline-none">
          {currentStep.title}
        </h2>
      </div>

      {/* Tous les champs restent montés : l'envoi final transmet l'ensemble du formulaire. */}
      <div hidden={currentStep.id !== "identity"} className="space-y-5">
        <div>
          <label htmlFor="firstName" className={labelClass}>
            Pr&eacute;nom
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            maxLength={100}
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="lastName" className={labelClass}>
            Nom
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            maxLength={100}
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div hidden={currentStep.id !== "account"} className="space-y-5">
        <div>
          <label htmlFor="email" className={labelClass}>
            Adresse e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="passwordConfirmation" className={labelClass}>
            Confirmation du mot de passe
          </label>
          <input
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {requiresAccessCode && (
        <div hidden={currentStep.id !== "accessCode"} className="space-y-2">
          <label htmlFor="accessCode" className={labelClass}>
            Code d&rsquo;acc&egrave;s
          </label>
          <input
            id="accessCode"
            name="accessCode"
            type="text"
            autoComplete="off"
            maxLength={32}
            required
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            className={inputClass}
            aria-describedby="accessCode-help"
          />
          <p id="accessCode-help" className={`text-sm ${mutedClass}`}>
            Code fourni par votre universit&eacute;.
          </p>
        </div>
      )}

      {currentStep.id === "review" && (
        <div className="space-y-4">
          <dl className="divide-y divide-[color:var(--color-border)] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] text-sm">
            <div className="flex items-start justify-between gap-3 p-3">
              <div>
                <dt className="font-semibold text-[color:var(--color-text)]">Identit&eacute;</dt>
                <dd>{firstName.trim()} {lastName.trim()}</dd>
              </div>
              <button type="button" onClick={() => goTo("identity")} className={editButtonClass}>
                Modifier
              </button>
            </div>
            <div className="flex items-start justify-between gap-3 p-3">
              <div>
                <dt className="font-semibold text-[color:var(--color-text)]">Compte</dt>
                <dd>{email.trim()}</dd>
              </div>
              <button type="button" onClick={() => goTo("account")} className={editButtonClass}>
                Modifier
              </button>
            </div>
            <div className="flex items-start justify-between gap-3 p-3">
              <div>
                <dt className="font-semibold text-[color:var(--color-text)]">Code d&rsquo;acc&egrave;s</dt>
                <dd>
                  {requiresAccessCode
                    ? "Saisi"
                    : "Aucun code d’accès n’est nécessaire pour cette université."}
                </dd>
              </div>
              {requiresAccessCode && (
                <button type="button" onClick={() => goTo("accessCode")} className={editButtonClass}>
                  Modifier
                </button>
              )}
            </div>
          </dl>
          <TurnstileField
            action="signup"
            onTokenChange={setTurnstileToken}
            resetKey={state}
          />
        </div>
      )}

      {stepError !== null ? (
        <p className={errorClass} role="alert">{stepError}</p>
      ) : null}
      {currentStep.id === "review" && state.message !== null ? (
        <p className={errorClass} role="alert">{state.message}</p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => goTo(steps[stepIndex - 1].id)}
            disabled={pending}
            className={`${secondaryButtonClass} sm:w-1/3`}
          >
            Retour
          </button>
        )}
        {currentStep.id === "review" ? (
          <button
            aria-busy={pending}
            type="submit"
            disabled={pending || !turnstileToken}
            className={primaryButtonClass}
          >
            <PendingLabel pending={pending} pendingText={"Création en cours…"}>{"Valider et créer mon compte"}</PendingLabel>
          </button>
        ) : (
          <button type="submit" className={primaryButtonClass}>
            Continuer
          </button>
        )}
      </div>
    </form>
  );
}
