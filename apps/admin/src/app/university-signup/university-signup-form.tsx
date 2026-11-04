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
import {
  registerUniversityAction,
  type UniversitySignupActionState,
} from "./actions";

const initialState: UniversitySignupActionState = {
  message: null,
  universityName: "",
  acronym: "",
  phone: "",
  showForm: true,
  showLoginLink: false,
};

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
  const [phone, setPhone] = useState(state.phone);

  const isSubmitDisabled =
    pending ||
    !universityName.trim() ||
    !acronym.trim() ||
    !phone.trim();

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
              Nom de l'universit&eacute;
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
            {pending ? "Envoi en cours\u2026" : "Cr\u00e9er l'universit\u00e9"}
          </button>
        </form>
      )}
      {state.showLoginLink && (
        <div className="mt-4">
          <Link href="/api/auth/signin" className={linkClass}>
            Aller &agrave; la connexion admin
          </Link>
        </div>
      )}
    </section>
  );
}
