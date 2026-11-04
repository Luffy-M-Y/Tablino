import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-page-background)] px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-sm font-bold uppercase tracking-widest text-[color:var(--color-admin-header)]">
          Tablino
        </p>
        <h1 className="text-center text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
          Connexion admin
        </h1>
        <p className="mb-8 mt-2 text-center text-sm text-[color:var(--color-muted-foreground)]">
          Acc&eacute;dez &agrave; votre espace d'administration.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
