export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyGoogleSignupToken } from "@tablino/auth";
import { hasStudentSession } from "@/lib/authorization";
import { GoogleRegisterForm } from "./google-register-form";

export default async function GoogleInscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  if (await hasStudentSession()) redirect("/");

  const params = await searchParams;
  const token = typeof params.token === "string" && params.token.length > 0
    ? params.token
    : "";
  let payload: ReturnType<typeof verifyGoogleSignupToken> = null;
  try {
    payload = token ? verifyGoogleSignupToken(token) : null;
  } catch {
    payload = null;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-uni-900 sm:text-3xl">Inscription avec Google</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {payload === null ? (
          <>
            <p className="text-sm text-slate-600">Lien expiré. Recommence avec Google.</p>
            <Link href="/connexion" className="mt-6 inline-block font-semibold text-uni-800 underline">
              Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-600">{"Compte Google : " + payload.email}</p>
            <GoogleRegisterForm token={token} />
          </>
        )}
      </div>
    </div>
  );
}
