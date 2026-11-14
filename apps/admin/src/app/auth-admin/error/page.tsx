import { AdminCard } from "@/components/admin-ui";

export const instant = false;

export default function AuthAdminErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-page-background)] px-4 py-6">
      <AdminCard className="w-full max-w-lg text-center">
        <h1 className="text-xl font-bold text-[color:var(--color-text)]">
          Erreur de connexion
        </h1>
        <p className="mt-3 text-sm text-[color:var(--color-muted-foreground)]">
          La connexion a échoué. Recommencez depuis votre université.
        </p>
      </AdminCard>
    </main>
  );
}
