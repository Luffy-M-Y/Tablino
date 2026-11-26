"use client";

import { startTransition, useActionState, useState } from "react";
import { TurnstileField } from "@/components/auth/TurnstileField";
import {
  errorClass,
  inputClass,
  labelClass,
  mutedClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/kit";
import { searchUniversitiesAction, type UniversitySearchState } from "./actions";
import { PendingLabel } from "@/components/ui/PendingLabel";

const initialState: UniversitySearchState = { message: null, results: null };

export function UniversitySearchForm() {
  const [state, formAction, pending] = useActionState(searchUniversitiesAction, initialState);
  const [acronym, setAcronym] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          // Envoi sans l'attribut action : React 19 ne réinitialise pas le
          // formulaire, l'acronyme saisi reste affiché.
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="acronym" className={labelClass}>
            Acronyme de votre universit&eacute;
          </label>
          <input
            id="acronym"
            name="acronym"
            type="text"
            maxLength={20}
            autoComplete="off"
            required
            value={acronym}
            onChange={(event) => setAcronym(event.target.value)}
            className={inputClass}
          />
        </div>
        <TurnstileField
          action="university_search"
          onTokenChange={setTurnstileToken}
          resetKey={state}
        />
        <button
          type="submit"
          disabled={pending || !turnstileToken || !acronym.trim()}
          className={primaryButtonClass}
        >
          <PendingLabel pending={pending} pendingText={"Recherche…"}>{"Rechercher"}</PendingLabel>
        </button>
      </form>
      {state.message !== null ? (
        <p className={state.results === null ? errorClass : `text-sm ${mutedClass}`} role={state.results === null ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
      {state.results !== null && state.results.length > 0 ? (
        <ul className="space-y-3" aria-label="Universités trouvées">
          {state.results.map((university) => (
            <li
              key={university.url}
              className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
            >
              <p className="font-semibold text-[color:var(--color-text)]">{university.name}</p>
              <p className={`mb-3 text-sm ${mutedClass}`}>
                {university.acronym}
                {university.locality ? ` · ${university.locality}` : ""}
              </p>
              <a href={university.url} className={secondaryButtonClass}>
                Acc&eacute;der &agrave; l&rsquo;espace &eacute;tudiant
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
