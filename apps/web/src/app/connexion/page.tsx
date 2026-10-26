export const instant = false;

import Link from "next/link";
import { GoogleSignInButton } from "./google-sign-in-button";
import { LoginForm } from "./login-form";

export default function ConnexionPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-uni-900 sm:text-3xl">Connexion</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <LoginForm />
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-sm text-slate-500">ou</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <GoogleSignInButton />
        <p className="mt-6 text-center text-sm text-slate-600">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-uni-800 underline">
            S’inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
