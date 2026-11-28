"use client";

import { startTransition, useActionState, useState } from "react";
import { errorClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth-ui";
import { startLogin2faEnrollmentAction, verifyLogin2faAction, type Login2faState } from "./actions";

export type TwoFactorView =
  | { kind: "code" }
  | { kind: "enroll-start" }
  | { kind: "enroll"; qrSize: number; qrPath: string; secret: string };

const initialState: Login2faState = { message: null };

export function TwoFactorForm({ view }: { view: TwoFactorView }) {
  const [startState, startAction, starting] = useActionState(startLogin2faEnrollmentAction, initialState);
  const [verifyState, verifyAction, verifying] = useActionState(verifyLogin2faAction, initialState);
  const [code, setCode] = useState("");
  const busy = starting || verifying;

  if (view.kind === "enroll-start") {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => startAction(formData));
        }}
        className="space-y-4"
      >
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          La double authentification est obligatoire pour les comptes d&apos;administration. Installez une application
          d&apos;authentification sur votre t&eacute;l&eacute;phone (Google Authenticator, Microsoft Authenticator,
          Aegis&hellip;), puis activez-la.
        </p>
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {starting ? "Préparation…" : "Activer la double authentification"}
        </button>
        {startState.message ? <p role="alert" className={errorClass}>{startState.message}</p> : null}
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {view.kind === "enroll" ? (
        <div className="space-y-3">
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Scannez ce QR code avec votre application d&apos;authentification, puis saisissez le code affich&eacute;.
          </p>
          <svg
            role="img"
            aria-label="QR code de la double authentification"
            viewBox={`0 0 ${view.qrSize} ${view.qrSize}`}
            shapeRendering="crispEdges"
            className="mx-auto h-56 w-56 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white"
          >
            <rect width={view.qrSize} height={view.qrSize} fill="#ffffff" />
            <path d={view.qrPath} fill="#000000" />
          </svg>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">Si le scan &eacute;choue, saisissez cette cl&eacute; :</p>
          <p className="break-all rounded-[var(--radius-rounded)] bg-[color:var(--color-page-background)] px-3 py-2 text-center font-mono text-base tracking-wider">
            {view.secret}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          Saisissez le code &agrave; 6 chiffres affich&eacute; par votre application d&apos;authentification.
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => verifyAction(formData));
        }}
        className="space-y-3"
      >
        <label htmlFor="totp-code" className={labelClass}>Code &agrave; 6 chiffres</label>
        <input
          id="totp-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          className={`${inputClass} text-center font-mono tracking-widest`}
        />
        <button type="submit" disabled={busy || code.length !== 6} className={primaryButtonClass}>
          {verifying ? "Vérification…" : view.kind === "enroll" ? "Activer et se connecter" : "Se connecter"}
        </button>
        {verifyState.message ? <p role="alert" className={errorClass}>{verifyState.message}</p> : null}
      </form>

      {view.kind === "enroll" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            setCode("");
            startTransition(() => startAction(formData));
          }}
          className="space-y-2"
        >
          <button type="submit" disabled={busy} className={secondaryButtonClass}>
            {starting ? "Préparation…" : "Générer un nouveau QR code"}
          </button>
          {startState.message ? <p role="alert" className={errorClass}>{startState.message}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
