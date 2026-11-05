export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { hasStudentSession } from "@/lib/authorization";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/ui/kit";
import { RegisterForm } from "./register-form";

export default async function InscriptionPage() {
  if (await hasStudentSession()) redirect("/");

  return (
    <AuthShell title={<>Inscription &eacute;tudiante</>}>
      <div className={authCardClass}>
        <RegisterForm />
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
