import { AdminCard } from "@/components/admin-ui";
import AdminPage from "@/components/admin-page";
import { requireSuperAdminAccess } from "@/lib/authorization";
import { InvitationForm } from "./invitation-form";

export default async function AdminInvitationsPage() {
  await requireSuperAdminAccess();

  return (
    <AdminPage
      title="Ajouter un admin"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Ajouter un admin" },
      ]}
      description="Invitez un éditeur à rejoindre l'administration Tablino."
    >
      <AdminCard className="max-w-2xl">
        <p className="mb-5 text-sm text-[color:var(--color-muted-foreground)]">
          L'invitation est valable 48 heures. L'adresse e-mail invitée ne peut
          créer qu'un compte éditeur super administrateur.
        </p>
        <InvitationForm />
      </AdminCard>
    </AdminPage>
  );
}
