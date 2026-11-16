import { AdminCard } from "@/components/admin-ui";
import AdminPage from "@/components/admin-page";
import { requireAdminPermission } from "@/lib/authorization";
import { InvitationForm } from "./invitation-form";

export default async function AdminInvitationsPage() {
  await requireAdminPermission("invitations");

  return (
    <AdminPage
      title="Ajouter un admin"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Ajouter un admin" },
      ]}
      description="Invitez un compte à rejoindre l'administration Tablino."
    >
      <AdminCard className="max-w-2xl">
        <p className="mb-5 text-sm text-[color:var(--color-muted-foreground)]">
          L'invitation est valable 48 heures. Chaque adresse e-mail ne peut
          avoir qu'une invitation en attente.
        </p>
        <InvitationForm />
      </AdminCard>
    </AdminPage>
  );
}
