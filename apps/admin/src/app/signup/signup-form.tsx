"use client";

import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/phone-countries";
import { useActionState, useState } from "react";
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/auth-ui";
import { signupAction, type SignupActionState } from "./actions";

const initialState: SignupActionState = {
  message: null,
  universityName: "",
  acronym: "",
  phone: "",
  email: "",
};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [universityName, setUniversityName] = useState(state.universityName);
  const [acronym, setAcronym] = useState(state.acronym);
  const [phone, setPhone] = useState(state.phone);
  const [email, setEmail] = useState(state.email);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const isSubmitDisabled =
    pending ||
    !universityName.trim() ||
    !acronym.trim() ||
    !phone.trim() ||
    !email.trim() ||
    !password ||
    !passwordConfirmation;

  return (
    <form action={formAction} className="space-y-4">
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
