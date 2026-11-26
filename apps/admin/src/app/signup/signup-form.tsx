"use client";

import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/phone-countries";
import {
  buildSignupAddressPreview,
  type SignupAddressDomains,
} from "@/lib/signup-address-preview.mjs";
import {
  findFirstInvalidSignupStep,
  SIGNUP_STEPS,
  validateSignupStep,
  type SignupStepId,
} from "@/lib/signup-steps.mjs";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth-ui";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { signupAction, type SignupActionState } from "./actions";
import { PendingLabel } from "@/components/pending-label";

const initialState: SignupActionState = {
  message: null,
  universityName: "",
  acronym: "",
  locality: "",
  visibility: "private",
  phone: "",
  email: "",
};

const radioClass =
  "mt-1 h-4 w-4 rounded border-[color:var(--color-input-border)] text-[color:var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

const editButtonClass =
  "text-sm font-semibold text-[color:var(--color-primary)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

export function SignupForm({ addressDomains }: { addressDomains: SignupAddressDomains | null }) {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [step, setStep] = useState<SignupStepId>("university");
  const [stepError, setStepError] = useState<string | null>(null);
  const [universityName, setUniversityName] = useState(state.universityName);
  const [acronym, setAcronym] = useState(state.acronym);
  const [locality, setLocality] = useState(state.locality);
  const [visibility, setVisibility] = useState(state.visibility);
  const [phone, setPhone] = useState(state.phone);
  const [email, setEmail] = useState(state.email);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);
  const addressPreview = buildSignupAddressPreview(acronym, locality, addressDomains);
  const values = { universityName, acronym, locality, visibility, phone, email, password, passwordConfirmation };
  const stepIndex = SIGNUP_STEPS.findIndex((item) => item.id === step);
  const currentStep = SIGNUP_STEPS[stepIndex];

  // Focus sur le titre de l'étape après chaque changement (lecteurs d'écran, clavier).
  useEffect(() => {
    if (hasNavigated.current) headingRef.current?.focus();
  }, [step]);

  function goTo(target: SignupStepId) {
    hasNavigated.current = true;
    setStepError(null);
    if (target !== "review") setTurnstileToken("");
    setStep(target);
  }

  function goNext() {
    const error = validateSignupStep(step, values);
    if (error !== null) {
      setStepError(error);
      return;
    }
    goTo(SIGNUP_STEPS[stepIndex + 1].id);
  }

  const isSubmitDisabled = pending || !turnstileToken;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        // Envoi sans l'attribut action : React 19 ne réinitialise pas le
        // formulaire, les champs et la visibilité restent après une erreur.
        event.preventDefault();
        if (step !== "review") {
          goNext();
          return;
        }
        const invalid = findFirstInvalidSignupStep(values);
        if (invalid !== null) {
          goTo(invalid.step);
          setStepError(invalid.error);
          return;
        }
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-5"
    >
      <ol className="grid grid-cols-4 gap-2" aria-label="Étapes de l'inscription">
        {SIGNUP_STEPS.map((item, index) => {
          const isCurrent = index === stepIndex;
          const isDone = index < stepIndex;
          return (
            <li key={item.id} aria-current={isCurrent ? "step" : undefined} className="text-center">
              <span
                aria-hidden="true"
                className={`block h-1.5 rounded-full ${
                  isCurrent || isDone ? "bg-[color:var(--color-primary)]" : "bg-[color:var(--color-border)]"
                }`}
              />
              <span
                className={`mt-1 block text-xs ${
                  isCurrent
                    ? "font-semibold text-[color:var(--color-text)]"
                    : "text-[color:var(--color-muted-foreground)]"
                }`}
              >
                {item.title}
              </span>
            </li>
          );
        })}
      </ol>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
          &Eacute;tape {stepIndex + 1} sur {SIGNUP_STEPS.length}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold text-[color:var(--color-text)] focus:outline-none">
          {currentStep.title}
        </h2>
      </div>

      {/* Tous les champs restent montés : l'envoi final transmet l'ensemble du formulaire. */}
      <div hidden={step !== "university"} className="space-y-4">
        <div>
          <label htmlFor="universityName" className={labelClass}>
            Nom complet de l&apos;universit&eacute;
          </label>
          <input
            id="universityName"
            name="universityName"
            type="text"
            maxLength={255}
            autoComplete="organization"
            required
            value={universityName}
            onChange={(e) => setUniversityName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="acronym" className={labelClass}>
            Acronyme
          </label>
          <input
            id="acronym"
            name="acronym"
            type="text"
            maxLength={20}
            required
            value={acronym}
            onChange={(e) => setAcronym(e.target.value)}
            className={inputClass}
            aria-describedby={addressDomains ? "signup-address-preview" : undefined}
          />
        </div>
        <div>
          <label htmlFor="locality" className={labelClass}>
            Localit&eacute; (facultatif)
          </label>
          <input
            id="locality"
            name="locality"
            type="text"
            maxLength={60}
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            className={inputClass}
            aria-describedby="locality-help"
          />
          <p id="locality-help" className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">
            Obligatoire si une universit&eacute; utilise d&eacute;j&agrave; cet acronyme (exemples : Ouaga, Bobo).
          </p>
        </div>
        {addressDomains && (
          <div
            id="signup-address-preview"
            className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4"
          >
            <p className="font-semibold text-[color:var(--color-text)]">Adresse pr&eacute;vue</p>
            {addressPreview.ok ? (
              <>
                <dl className="mt-2 space-y-1 text-sm">
                  <div>
                    <dt className="inline">&Eacute;tudiants : </dt>
                    <dd className="inline font-mono">{addressPreview.students}</dd>
                  </div>
                  <div>
                    <dt className="inline">Administration : </dt>
                    <dd className="inline font-mono">{addressPreview.admin}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">
                  Confirm&eacute;e &agrave; la validation du contrat de partenariat.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">
                {acronym.trim()
                  ? "Aperçu indisponible : vérifiez l’acronyme et la localité."
                  : "Saisissez l’acronyme pour voir l’adresse prévue."}
              </p>
            )}
          </div>
        )}
      </div>

      <div hidden={step !== "access"} className="space-y-3">
        <p className={labelClass}>Visibilit&eacute; de l&apos;universit&eacute;</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="visibility"
            value="private"
            checked={visibility === "private"}
            onChange={() => setVisibility("private")}
            className={radioClass}
          />
          <span className="text-sm text-[color:var(--color-foreground)]">
            Priv&eacute;e : un code d&apos;acc&egrave;s est exig&eacute; &agrave; l&apos;inscription.
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="visibility"
            value="public"
            checked={visibility === "public"}
            onChange={() => setVisibility("public")}
            className={radioClass}
          />
          <span className="text-sm text-[color:var(--color-foreground)]">
            Publique : compte &eacute;tudiant obligatoire, sans code d&apos;acc&egrave;s.
          </span>
        </label>
        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          Modifiable jusqu&apos;&agrave; la validation du contrat, puis depuis la page des codes.
        </p>
      </div>

      <div hidden={step !== "account"} className="space-y-4">
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
          <label htmlFor="phone" className={labelClass}>
            T&eacute;l&eacute;phone
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-52">
              <label htmlFor="phoneCountry" className="sr-only">
                Pays
              </label>
              <select
                id="phoneCountry"
                name="phoneCountry"
                disabled
                value={DEFAULT_PHONE_COUNTRY.code}
                className="h-11 w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-[color:var(--color-page-background)] px-3 text-base text-[color:var(--color-text)] cursor-not-allowed opacity-90"
              >
                {PHONE_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.nom} ({country.indicatif})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <input
                id="phone"
                name="phone"
                type="tel"
                maxLength={32}
                autoComplete="tel-national"
                required
                placeholder="Ex. 70 12 34 56"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
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

      {step === "review" && (
        <div className="space-y-4">
          <dl className="divide-y divide-[color:var(--color-border)] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] text-sm">
            <div className="flex items-start justify-between gap-3 p-3">
              <div>
                <dt className="font-semibold text-[color:var(--color-text)]">Universit&eacute;</dt>
                <dd className="text-[color:var(--color-foreground)]">
                  {universityName.trim()} ({acronym.trim()}{locality.trim() ? ` · ${locality.trim()}` : ""})
                </dd>
                {addressDomains && addressPreview.ok && (
                  <dd className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
                    {addressPreview.students} · {addressPreview.admin}
                  </dd>
                )}
              </div>
              <button type="button" onClick={() => goTo("university")} className={editButtonClass}>
                Modifier
              </button>
            </div>
            <div className="flex items-start justify-between gap-3 p-3">
              <div>
                <dt className="font-semibold text-[color:var(--color-text)]">Acc&egrave;s &eacute;tudiant</dt>
                <dd className="text-[color:var(--color-foreground)]">
                  {visibility === "public" ? "Publique, sans code d’accès" : "Privée, avec code d’accès"}
                </dd>
              </div>
              <button type="button" onClick={() => goTo("access")} className={editButtonClass}>
                Modifier
              </button>
            </div>
            <div className="flex items-start justify-between gap-3 p-3">
              <div>
                <dt className="font-semibold text-[color:var(--color-text)]">Compte</dt>
                <dd className="text-[color:var(--color-foreground)]">{email.trim()}</dd>
                <dd className="text-[color:var(--color-foreground)]">
                  {DEFAULT_PHONE_COUNTRY.indicatif} {phone.trim()}
                </dd>
              </div>
              <button type="button" onClick={() => goTo("account")} className={editButtonClass}>
                Modifier
              </button>
            </div>
          </dl>
          <TurnstileField
            action="signup"
            onTokenChange={setTurnstileToken}
            resetKey={state}
          />
        </div>
      )}

      {stepError !== null && (
        <p role="alert" className={errorClass}>
          {stepError}
        </p>
      )}
      {step === "review" && state.message !== null && (
        <p role="alert" className={errorClass}>
          {state.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => goTo(SIGNUP_STEPS[stepIndex - 1].id)}
            disabled={pending}
            className={`${secondaryButtonClass} sm:w-1/3`}
          >
            Retour
          </button>
        )}
        {step === "review" ? (
          <button aria-busy={pending} type="submit" disabled={isSubmitDisabled} className={primaryButtonClass}>
            <PendingLabel pending={pending} pendingText={"Création en cours…"}>{"Valider et créer le compte"}</PendingLabel>
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
