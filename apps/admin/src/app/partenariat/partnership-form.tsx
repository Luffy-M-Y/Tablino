"use client";

import { startTransition, useActionState, useState } from "react";
import { inputClass, labelClass, errorClass, primaryButtonClass } from "@/components/auth-ui";
import { ALLOWED_OPERATORS } from "@/lib/partnership-validation.mjs";
import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES } from "@/lib/phone-countries";
import {
  completePartnershipAction,
  type PartnershipActionState,
} from "./actions";
import { PendingLabel } from "@/components/pending-label";

const initialState: PartnershipActionState = {
  status: "idle",
  message: null,
};

export function PartnershipForm({ addressReady }: { addressReady: boolean }) {
  const [state, formAction, pending] = useActionState(completePartnershipAction, initialState);
  const [holderName, setHolderName] = useState("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [addressesConfirmed, setAddressesConfirmed] = useState(false);

  const isSubmitDisabled =
    pending ||
    !addressReady ||
    !addressesConfirmed ||
    holderName.trim().length < 2 ||
    !phone.trim() ||
    !accepted;

  return (
    <form
      onSubmit={(event) => {
        // Envoi sans l'attribut action : React 19 ne réinitialise pas le
        // formulaire, l'opérateur choisi reste après une erreur.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-5"
    >
      {state.message && (
        <div role="alert" className={errorClass}>
          {state.message}
        </div>
      )}

      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            id="confirmAddresses"
            name="confirmAddresses"
            type="checkbox"
            required
            checked={addressesConfirmed}
            disabled={!addressReady}
            onChange={(event) => setAddressesConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[color:var(--color-input-border)] text-[color:var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
          />
          <span className="text-sm text-[color:var(--color-foreground)]">
            J’ai vérifié le récapitulatif : ces adresses sont définitives.
          </span>
        </label>
        {state.errors?.confirmAddresses && (
          <p className="mt-1 text-xs font-medium text-[color:var(--color-destructive-text)]">{state.errors.confirmAddresses}</p>
        )}
      </div>

      <div>
        <label htmlFor="operator" className={labelClass}>
          Opérateur Mobile Money
        </label>
        <select
          id="operator"
          name="operator"
          required
          defaultValue={ALLOWED_OPERATORS[0]}
          className={inputClass}
        >
          {ALLOWED_OPERATORS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
        {state.errors?.operator && (
          <p className="mt-1 text-xs font-medium text-[color:var(--color-destructive-text)]">{state.errors.operator}</p>
        )}
      </div>

      <div>
        <label htmlFor="holderName" className={labelClass}>
          Nom et prénom(s) du titulaire du compte
        </label>
        <input
          id="holderName"
          name="holderName"
          type="text"
          required
          minLength={2}
          maxLength={100}
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          placeholder="Ex. Nom Prénom ou Trésorerie"
          className={inputClass}
        />
        {state.errors?.holderName && (
          <p className="mt-1 text-xs font-medium text-[color:var(--color-destructive-text)]">{state.errors.holderName}</p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>
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
              className={`${inputClass} cursor-not-allowed`}
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        {state.errors?.phone && (
          <p className="mt-1 text-xs font-medium text-[color:var(--color-destructive-text)]">{state.errors.phone}</p>
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
            className="mt-1 h-4 w-4 rounded border-[color:var(--color-input-border)] text-[color:var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
          />
          <span className="text-sm text-[color:var(--color-foreground)]">
            J’accepte les clauses du contrat de partenariat et la part qui revient à l’université.
          </span>
        </label>
        {state.errors?.acceptContract && (
          <p className="mt-1 text-xs font-medium text-[color:var(--color-destructive-text)]">{state.errors.acceptContract}</p>
        )}
      </div>

      <div className="pt-4">
        <button
          aria-busy={pending}
          type="submit"
          disabled={isSubmitDisabled}
          className={primaryButtonClass}
        >
          <PendingLabel pending={pending} pendingText={"Validation en cours…"}>{"Accepter le contrat et finaliser le partenariat"}</PendingLabel>
        </button>
      </div>
    </form>
  );
}
