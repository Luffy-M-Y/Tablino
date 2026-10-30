export const instant = false;

import { decideStudentAccess } from "@tablino/db";
import { forbidden, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/authorization";
import { TrialForm } from "./trial-form";

export default async function ChoisirAccesPage() {
  const user = await requireStudentSession();
  const decision = decideStudentAccess(user, new Date());
  const trialUsed = user.trialEndsAt !== null;

  if (decision === "revoked") forbidden();
  if (decision === "allowed") redirect("/");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-uni-900 sm:text-3xl">Choisir mon accès</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-uni-800 to-uni-600 p-8 text-white shadow-lg hover:shadow-xl transition-shadow focus-visible:ring-2 focus-visible:ring-uni-600 focus-visible:ring-offset-2">
          <h2 className="mb-2 text-2xl font-bold">Essai gratuit</h2>
          {!trialUsed ? (
            <>
              <p className="mb-6 text-sm text-white/75">
                Profitez d’un mois d’essai avec les mêmes droits que Premium pro, une seule fois.
              </p>
              <TrialForm />
            </>
          ) : (
            <div role="status" className="rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-sm text-white">
              Vous avez déjà utilisé l’essai gratuit. Passez à Premium pro ou à Premium pro max.
            </div>
          )}
        </section>

        <section className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-uni-800 to-uni-600 p-8 text-white shadow-lg hover:shadow-xl transition-shadow focus-visible:ring-2 focus-visible:ring-uni-600 focus-visible:ring-offset-2">
          <h2 className="mb-2 text-2xl font-bold">Premium pro</h2>
          <p className="mb-6 text-sm text-white/75">
            Accédez à vos cours et devoirs avec les droits Premium pro.
          </p>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl bg-white/20 px-4 py-3 font-semibold text-white/75"
          >
            Bientôt disponible
          </button>
        </section>

        <section className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 to-teal-600 p-8 text-white shadow-lg hover:shadow-xl transition-shadow focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">
          <h2 className="mb-2 text-2xl font-bold">Premium pro max</h2>
          <p className="mb-6 text-sm text-white/75">
            Profitez des droits Premium pro max, y compris le téléchargement hors ligne.
          </p>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl bg-white/20 px-4 py-3 font-semibold text-white/75"
          >
            Bientôt disponible
          </button>
        </section>
      </div>
    </div>
  );
}
