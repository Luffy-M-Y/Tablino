export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyGoogleSignupToken } from "@tablino/auth";
import { hasStudentSession } from "@/lib/authorization";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/ui/kit";
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
    <AuthShell title="Inscription avec Google" wide>
      <div className={authCardClass}>
        {payload === null ? (
          <>
            <p className={`text-sm ${mutedClass}`}>Lien expir&eacute;. Recommence avec Google.</p>
            <Link href="/connexion" className={`mt-6 ${linkClass}`}>
              Retour &agrave; la connexion
            </Link>
          </>
        ) : (
          <>
            <p className={`mb-6 text-sm ${mutedClass}`}>{"Compte Google : " + payload.email}</p>
            <GoogleRegisterForm token={token} />
          </>
        )}
      </div>
    </AuthShell>
  );
}
