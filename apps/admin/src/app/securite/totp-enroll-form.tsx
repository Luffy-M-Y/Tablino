"use client";

import { CheckCircle2, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import {
  AdminCard,
  adminFieldClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin-ui";
import { confirmTotpEnrollmentAction, startTotpEnrollmentAction, type TotpEnrollState } from "./actions";

export type TotpEnrollView =
  | { kind: "none" }
  | { kind: "pending"; qrSize: number; qrPath: string; secret: string }
  | { kind: "unreadable" }
  | { kind: "enabled" };

const initialState: TotpEnrollState = { status: "idle", message: null };

function Message({ state }: { state: TotpEnrollState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`text-sm font-medium ${state.status === "error" ? "text-red-700" : "text-green-800"}`}
    >
      {state.message}
    </p>
  );
}

export function TotpEnrollForm({ view }: { view: TotpEnrollView }) {
  const [startState, startAction, starting] = useActionState(startTotpEnrollmentAction, initialState);
  const [confirmState, confirmAction, confirming] = useActionState(confirmTotpEnrollmentAction, initialState);
  const [code, setCode] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);
  // Code refusé : il reste affiché, sélectionné ; une frappe le remplace (comme /verify).
  useEffect(() => {
    if (confirmState.status === "error") codeInputRef.current?.select();
  }, [confirmState]);
  const busy = starting || confirming;

  if (view.kind === "enabled") {
    return (
      <AdminCard className="space-y-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={24} aria-hidden="true" className="shrink-0 text-green-800" />
          <h2 className="text-lg font-semibold">Double authentification active</h2>
        </div>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          Votre compte est protégé par un code à 6 chiffres. Pour changer de téléphone, une remise à zéro de la double
          authentification est nécessaire.
        </p>
        <Message state={confirmState} />
      </AdminCard>
    );
  }

  const startForm = (label: string, primary: boolean) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setCode("");
        startTransition(() => startAction(formData));
      }}
    >
      <button type="submit" disabled={busy} className={`gap-2 ${primary ? adminPrimaryButtonClass : adminSecondaryButtonClass}`}>
        {primary ? <ShieldCheck size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
        {starting ? "Préparation…" : label}
      </button>
    </form>
  );

  if (view.kind === "none" || view.kind === "unreadable") {
    return (
      <AdminCard className="space-y-4">
        <h2 className="text-lg font-semibold">Activer la double authentification</h2>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          {view.kind === "unreadable"
            ? "L’activation en cours ne peut plus être lue. Recommencez pour obtenir un nouveau QR code."
            : "À chaque connexion, un code à 6 chiffres vous sera demandé. Installez d’abord une application d’authentification sur votre téléphone (Google Authenticator, Microsoft Authenticator, Aegis…)."}
        </p>
        {startForm(view.kind === "unreadable" ? "Recommencer l’activation" : "Activer", true)}
        <Message state={startState} />
      </AdminCard>
    );
  }

  return (
    <AdminCard className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Scannez le QR code</h2>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          Ouvrez votre application d’authentification, ajoutez un compte, puis scannez ce code.
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <svg
          role="img"
          aria-label="QR code de la double authentification"
          viewBox={`0 0 ${view.qrSize} ${view.qrSize}`}
          shapeRendering="crispEdges"
          className="h-56 w-56 shrink-0 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white"
        >
          <rect width={view.qrSize} height={view.qrSize} fill="#ffffff" />
          <path d={view.qrPath} fill="#000000" />
        </svg>
        <div className="min-w-0 space-y-2 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <KeyRound size={16} aria-hidden="true" />
            Saisie manuelle
          </p>
          <p className="text-[color:var(--color-muted-foreground)]">Si le scan échoue, saisissez cette clé :</p>
          <p className="break-all rounded-[var(--radius-rounded)] bg-[color:var(--color-page-background)] px-3 py-2 font-mono text-base tracking-wider">
            {view.secret}
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => confirmAction(formData));
        }}
        className="space-y-3"
      >
        <label htmlFor="totp-code" className={adminLabelClass}>Code à 6 chiffres</label>
        <input
          id="totp-code"
          name="code"
          ref={codeInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          className={`${adminFieldClass} max-w-48 font-mono tracking-widest`}
        />
        <button type="submit" disabled={busy || code.length !== 6} className={`gap-2 ${adminPrimaryButtonClass}`}>
          <ShieldCheck size={16} aria-hidden="true" />
          {confirming ? "Vérification…" : "Confirmer l’activation"}
        </button>
        <Message state={confirmState} />
      </form>

      <div className="space-y-2 border-t border-[color:var(--color-border)] pt-4">
        {startForm("Générer un nouveau QR code", false)}
        <Message state={startState} />
      </div>
    </AdminCard>
  );
}
