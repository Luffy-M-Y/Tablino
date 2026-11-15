import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { AdminCard } from "@/components/admin-ui";
import AdminPage from "@/components/admin-page";
import { getAdminHostContext } from "@/lib/admin-host-context";
import {
  checkSuperAdminEditorInvitationToken,
} from "@tablino/db";
import {
  getSuperAdminEditorInvitationMessage,
  SUPER_ADMIN_EDITOR_INVITATION_COOKIE,
} from "@/lib/super-admin-editor-invitation.mjs";
import { AcceptInvitationForm } from "./accept-form";

export const metadata = { referrer: "no-referrer" };

export default async function AcceptAdminInvitationPage() {
  const hostContext = await getAdminHostContext();
  if (hostContext?.kind !== "super") notFound();

  const token = (await cookies()).get(SUPER_ADMIN_EDITOR_INVITATION_COOKIE)?.value;
  const available = token
    ? await checkSuperAdminEditorInvitationToken(token)
    : false;

  return (
    <AdminPage
      title="Accepter une invitation"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Accepter une invitation" },
      ]}
    >
      <AdminCard className="max-w-xl">
        {available ? (
          <>
            <p className="mb-5 text-sm text-[color:var(--color-muted-foreground)]">
              Choisissez un mot de passe pour créer votre compte éditeur.
            </p>
            <AcceptInvitationForm />
          </>
        ) : (
          <p role="alert" className="text-sm text-red-900">
            {getSuperAdminEditorInvitationMessage("unavailable")}
          </p>
        )}
      </AdminCard>
    </AdminPage>
  );
}
