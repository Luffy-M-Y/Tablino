export const instant = false;

import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function InscriptionPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-uni-900 sm:text-3xl">Inscription étudiante</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-slate-600">
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-semibold text-uni-800 underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
