export const instant = false;

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getEmailVerificationCookieConfig,
  verifyEmailVerificationToken,
} from "@tablino/auth";
import { hasStudentSession } from "@/lib/authorization";
import { VerificationForms } from "./verification-forms";

export default async function VerificationPage() {
  if (await hasStudentSession()) redirect("/");

  const cookieStore = await cookies();
  const raw = cookieStore.get(getEmailVerificationCookieConfig().name)?.value ?? "";
  let userId: string | null = null;
  try {
    userId = raw ? verifyEmailVerificationToken(raw) : null;
  } catch {
    userId = null;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-uni-900 sm:text-3xl">Vérification de l'email</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {userId === null ? (
          <>
            <p className="text-sm text-slate-600">
              Lien expiré. Recommence ton inscription ou connecte-toi.
            </p>
            <Link href="/connexion" className="mt-6 inline-block font-semibold text-uni-800 underline">
              Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-600">
              Un code à 6 chiffres a été envoyé à ton adresse e-mail. Il est valable 10 minutes.
            </p>
            <VerificationForms />
          </>
        )}
      </div>
    </div>
  );
}
