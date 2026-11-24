"use client";

import { startTransition, useActionState, useState } from "react";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/auth-ui";
import {
  buildSignupAddressPreview,
  type SignupAddressDomains,
} from "@/lib/signup-address-preview.mjs";
import { updateRegistrationAction, type RegistrationActionState } from "./actions";

const radioClass =
  "mt-1 h-4 w-4 rounded border-[color:var(--color-input-border)] text-[color:var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

export function RegistrationForm({
  initialAcronym,
  initialLocality,
  initialVisibility,
  addressDomains,
}: {
  initialAcronym: string;
  initialLocality: string;
  initialVisibility: "private" | "public";
  addressDomains: SignupAddressDomains | null;
}) {
  const initialState: RegistrationActionState = {
    status: "idle",
    message: null,
    acronym: initialAcronym,
    locality: initialLocality,
    visibility: initialVisibility,
  };
  const [state, formAction, pending] = useActionState(updateRegistrationAction, initialState);
  const [acronym, setAcronym] = useState(state.acronym);
  const [locality, setLocality] = useState(state.locality);
  const [visibility, setVisibility] = useState(state.visibility);
  const addressPreview = buildSignupAddressPreview(acronym, locality, addressDomains);

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-semibold text-[color:var(--color-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]">
        Modifier l&apos;acronyme, la localit&eacute; ou la visibilit&eacute;
      </summary>
      <form
        onSubmit={(event) => {
          // Envoi sans l'attribut action : React 19 ne réinitialise pas le
          // formulaire, les champs et la visibilité restent après une erreur.
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="mt-4 space-y-4"
      >
        <div>
          <label htmlFor="registration-acronym" className={labelClass}>
            Acronyme
          </label>
          <input
            id="registration-acronym"
            name="acronym"
            type="text"
            maxLength={20}
            required
            value={acronym}
            onChange={(event) => setAcronym(event.target.value)}
            className={inputClass}
            aria-describedby={addressDomains ? "registration-address-preview" : undefined}
          />
        </div>
        <div>
          <label htmlFor="registration-locality" className={labelClass}>
            Localit&eacute; (facultatif)
          </label>
          <input
            id="registration-locality"
            name="locality"
            type="text"
            maxLength={60}
            value={locality}
            onChange={(event) => setLocality(event.target.value)}
            className={inputClass}
            aria-describedby="registration-locality-help"
          />
          <p id="registration-locality-help" className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">
            Obligatoire si une universit&eacute; utilise d&eacute;j&agrave; cet acronyme (exemples : Ouaga, Bobo).
          </p>
        </div>
        {addressDomains && (
          <div id="registration-address-preview" className="text-sm text-[color:var(--color-foreground)]">
            {addressPreview.ok ? (
              <p>
                Nouvelle adresse pr&eacute;vue : <span className="font-mono">{addressPreview.students}</span> et{" "}
                <span className="font-mono">{addressPreview.admin}</span>
              </p>
            ) : (
              <p className="text-[color:var(--color-muted-foreground)]">
                {acronym.trim()
                  ? "Aperçu indisponible : vérifiez l’acronyme et la localité."
                  : "Saisissez l’acronyme pour voir l’adresse prévue."}
              </p>
            )}
          </div>
        )}
        <div>
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
        </div>
        {state.message !== null && (
          <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? errorClass : "text-sm text-[color:var(--color-foreground)]"}>
            {state.message}
          </p>
        )}
        <button type="submit" disabled={pending || !acronym.trim()} className={primaryButtonClass}>
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </form>
    </details>
  );
}
