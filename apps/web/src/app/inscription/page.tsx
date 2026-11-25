export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { getUniversityPartnershipInfo } from "@tablino/db";
import { hasStudentSession } from "@/lib/authorization";
import { getCurrentUniversityId } from "@/lib/university";
import { BackButton } from "@/components/ui/BackButton";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/ui/kit";
import { RegisterForm } from "./register-form";

export default async function InscriptionPage() {
  if (await hasStudentSession()) redirect("/");

  // Université publique : inscription sans code d'accès. Visibilité inconnue : code exigé.
  const university = await getUniversityPartnershipInfo(await getCurrentUniversityId());
  const requiresAccessCode = university?.visibility !== "public";

  return (
    <AuthShell title={<>Inscription &eacute;tudiante</>}>
      <BackButton href="/" className="mb-3">
        Retour à l&rsquo;accueil
      </BackButton>
      <div className={authCardClass}>
        <RegisterForm requiresAccessCode={requiresAccessCode} />
        <p className={`mt-6 text-center text-sm ${mutedClass}`}>
          D&eacute;j&agrave; inscrit ?{" "}
          <Link href="/connexion" className={linkClass}>
            Se connecter
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
