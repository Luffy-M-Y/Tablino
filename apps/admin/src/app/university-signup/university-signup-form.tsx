"use client";

import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/phone-countries";
import Link from "next/link";
import { useActionState, useState } from "react";
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
    <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
      <p className="mb-6 text-sm text-slate-600">Compte Google : {email}</p>
      {state.message && (
        <p role="alert" className="mb-4 text-sm text-red-700">{state.message}</p>
      )}
      {state.showForm && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="universityName" className="mb-2 block font-medium">
              Nom de l'université
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
              className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
            />
          </div>
          <div>
            <label htmlFor="acronym" className="mb-2 block font-medium">
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
              className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-2 block font-medium">
              Téléphone
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
                  className="w-full rounded border border-[color:var(--color-border)] bg-slate-50 px-3 py-2 text-[color:var(--color-text)] cursor-not-allowed opacity-90"
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
                  className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Envoi en cours…" : "Créer l'université"}
          </button>
        </form>
      )}
      {state.showLoginLink && (
        <Link
          href="/api/auth/signin"
          className="inline-block font-semibold text-[color:var(--color-university-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        >
          Aller à la connexion admin
        </Link>
      )}
    </section>
  );
}
