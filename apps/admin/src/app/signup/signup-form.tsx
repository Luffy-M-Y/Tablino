"use client";

import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/phone-countries";
import {
  buildSignupAddressPreview,
  type SignupAddressDomains,
} from "@/lib/signup-address-preview.mjs";
import { startTransition, useActionState, useState } from "react";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/auth-ui";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { signupAction, type SignupActionState } from "./actions";

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

export function SignupForm({ addressDomains }: { addressDomains: SignupAddressDomains | null }) {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [universityName, setUniversityName] = useState(state.universityName);
  const [acronym, setAcronym] = useState(state.acronym);
  const [locality, setLocality] = useState(state.locality);
  const [visibility, setVisibility] = useState(state.visibility);
  const [phone, setPhone] = useState(state.phone);
  const [email, setEmail] = useState(state.email);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const addressPreview = buildSignupAddressPreview(acronym, locality, addressDomains);

  const isSubmitDisabled =
    pending ||
    !universityName.trim() ||
    !acronym.trim() ||
    !phone.trim() ||
    !email.trim() ||
    !password ||
    !passwordConfirmation ||
    !turnstileToken;

  return (
    <form
      onSubmit={(event) => {
        // Envoi sans l'attribut action : React 19 ne réinitialise pas le
        // formulaire, les champs et la visibilité restent après une erreur.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="universityName" className={labelClass}>
          Nom complet de l'universit&eacute;
        </label>
        <input
          id="universityName"
          name="universityName"
          type="text"
          minLength={1}
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
      <div>
        <p className={labelClass}>Visibilit&eacute; de l&apos;universit&eacute;</p>
        <div>
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
        </div>
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
      <TurnstileField
        action="signup"
        onTokenChange={setTurnstileToken}
        resetKey={state}
      />
      {state.message !== null && (
        <p role="alert" className={errorClass}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitDisabled}
        className={primaryButtonClass}
      >
        {pending ? "Cr\u00e9ation en cours\u2026" : "Cr\u00e9er le compte"}
      </button>
    </form>
  );
}
