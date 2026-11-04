"use client";

import { useActionState, useState } from "react";
import { ALLOWED_OPERATORS } from "@/lib/partnership-validation.mjs";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/phone-countries";
import {
  completePartnershipAction,
  type PartnershipActionState,
} from "./actions";

const initialState: PartnershipActionState = {
  status: "idle",
  message: null,
};

export function PartnershipForm() {
  const [state, formAction, pending] = useActionState(completePartnershipAction, initialState);
  const [accepted, setAccepted] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="operator" className="mb-2 block text-sm font-medium text-[color:var(--color-text)]">
          Opérateur Mobile Money
        </label>
        <select
          id="operator"
          name="operator"
          required
          defaultValue={ALLOWED_OPERATORS[0]}
          className="w-full rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        >
          {ALLOWED_OPERATORS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
        {state.errors?.operator && (
          <p className="mt-1 text-xs text-red-600">{state.errors.operator}</p>
        )}
      </div>

      <div>
        <label htmlFor="holderName" className="mb-2 block text-sm font-medium text-[color:var(--color-text)]">
          Nom et prénom(s) du titulaire du compte
        </label>
        <input
          id="holderName"
          name="holderName"
          type="text"
          required
          minLength={2}
          maxLength={100}
          placeholder="Ex. Nom Prénom ou Trésorerie"
          className="w-full rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        />
        {state.errors?.holderName && (
          <p className="mt-1 text-xs text-red-600">{state.errors.holderName}</p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="mb-2 block text-sm font-medium text-[color:var(--color-text)]">
          Numéro de téléphone Mobile Money
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
              className="w-full rounded border border-[color:var(--color-border)] bg-slate-50 px-3 py-2 text-sm text-[color:var(--color-text)] cursor-not-allowed opacity-90"
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
              required
              placeholder="Ex. 70 00 00 00"
              autoComplete="tel-national"
              className="w-full rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
            />
          </div>
        </div>
        {state.errors?.phone && (
          <p className="mt-1 text-xs text-red-600">{state.errors.phone}</p>
        )}
      </div>

      <div className="pt-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            id="acceptContract"
            name="acceptContract"
            type="checkbox"
            required
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[color:var(--color-border)] text-[color:var(--color-university-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
          />
          <span className="text-sm text-slate-700">
            J’accepte les clauses du contrat de partenariat et la part qui revient à l’université.
          </span>
        </label>
        {state.errors?.acceptContract && (
          <p className="mt-1 text-xs text-red-600">{state.errors.acceptContract}</p>
        )}
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={pending || !accepted}
          className="w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-subtle)] hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)] disabled:opacity-60"
        >
          {pending ? "Validation en cours…" : "Accepter le contrat et finaliser le partenariat"}
        </button>
      </div>
    </form>
  );
}

