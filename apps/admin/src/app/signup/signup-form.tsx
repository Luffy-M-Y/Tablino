"use client";

import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/phone-countries";
import { useActionState } from "react";
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

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="universityName" className="mb-2 block font-medium">
          Nom complet de l'université
        </label>
        <input
          id="universityName"
          name="universityName"
          type="text"
          minLength={1}
          maxLength={255}
          autoComplete="organization"
          required
          defaultValue={state.universityName}
          key={state.universityName}
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
          defaultValue={state.acronym}
          key={state.acronym}
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
              autoComplete="tel"
              placeholder="Ex. 70 12 34 56"
              defaultValue={state.phone}
              key={state.phone}
              className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
            />
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="email" className="mb-2 block font-medium">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          key={state.email}
          className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block font-medium">
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
          className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        />
      </div>
      <div>
        <label htmlFor="passwordConfirmation" className="mb-2 block font-medium">
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
          className="w-full rounded border border-[color:var(--color-border)] px-3 py-2 text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Création en cours…" : "Créer le compte"}
      </button>
      {state.message !== null && (
        <p role="alert" className="text-sm text-red-700">{state.message}</p>
      )}
    </form>
  );
}
