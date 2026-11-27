"use client";

import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/phone-countries";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  authCardClass,
  errorClass,
  inputClass,
  labelClass,
  linkClass,
  primaryButtonClass,
} from "@/components/auth-ui";
import { TurnstileField } from "@/components/auth/TurnstileField";
import {
  registerUniversityAction,
  type UniversitySignupActionState,
} from "./actions";
import { PendingLabel } from "@/components/pending-label";

const initialState: UniversitySignupActionState = {
  message: null,
  universityName: "",
  acronym: "",
  locality: "",
  visibility: "private",
  phone: "",
  showForm: true,
  showLoginLink: false,
};

const radioClass =
  "mt-1 h-4 w-4 rounded border-[color:var(--color-input-border)] text-[color:var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

export function UniversitySignupForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(registerUniversityAction, initialState);
  const [universityName, setUniversityName] = useState(state.universityName);
  const [acronym, setAcronym] = useState(state.acronym);
  const [locality, setLocality] = useState(state.locality);
  const [visibility, setVisibility] = useState(state.visibility);
  const [phone, setPhone] = useState(state.phone);
  const [turnstileToken, setTurnstileToken] = useState("");

  const isSubmitDisabled =
    pending ||
    !universityName.trim() ||
    !acronym.trim() ||
    !phone.trim() ||
    !turnstileToken;

  return (
    <section className={authCardClass}>
      <p className="mb-4 text-sm text-[color:var(--color-muted-foreground)]">
        Compte Google : {email}
      </p>
      {!state.showForm && state.message !== null && (
        <p role="alert" className={`mb-4 ${errorClass}`}>
          {state.message}
        </p>
      )}
      {state.showForm && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="universityName" className={labelClass}>
              Nom de l&apos;universit&eacute;
            </label>
            <input
              id="universityName"
              name="universityName"
              type="text"
              minLength={1}
              maxLength={255}
              required
              value={universityName}
              onChange={(e) => setUniversityName(e.target.value)}
              autoComplete="organization"
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
          <fieldset className="space-y-3">
            <legend className={labelClass}>Visibilit&eacute; de l&apos;universit&eacute;</legend>
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
          </fieldset>
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
          <TurnstileField
            action="signup_google"
            onTokenChange={setTurnstileToken}
            resetKey={state}
          />
          {state.message !== null && (
            <p role="alert" className={errorClass}>
              {state.message}
            </p>
          )}
          <button
            aria-busy={pending}
            type="submit"
            disabled={isSubmitDisabled}
            className={primaryButtonClass}
          >
            <PendingLabel pending={pending} pendingText={"Envoi en cours\u2026"}>{"Cr\u00e9er l'universit\u00e9"}</PendingLabel>
          </button>
        </form>
      )}
      {state.showLoginLink && (
        <div className="mt-4">
          <Link href="/login" className={linkClass}>
            Aller &agrave; la connexion admin
          </Link>
        </div>
      )}
    </section>
  );
}
