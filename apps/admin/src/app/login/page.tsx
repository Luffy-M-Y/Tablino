import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
        Connexion admin
      </h1>
      <LoginForm />
    </main>
  );
}
