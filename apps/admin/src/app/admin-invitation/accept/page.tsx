import { notFound } from "next/navigation";
import { cookies } from "next/headers";
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
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-page-background)] px-4 py-6 sm:px-6">
      <div className="w-full max-w-xl">
        <p className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-[color:var(--color-admin-header)]">
          Tablino
        </p>
        <h1 className="text-center text-xl font-bold text-[color:var(--color-text)] sm:text-2xl">
          Accepter une invitation
        </h1>
        {available ? (
          <p className="mb-5 mt-1 text-center text-sm text-[color:var(--color-muted-foreground)]">
            Choisissez un mot de passe pour créer votre compte éditeur.
          </p>
        ) : null}
        <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:p-6">
          {available ? (
            <AcceptInvitationForm />
          ) : (
            <p role="alert" className="text-sm text-red-900">
              {getSuperAdminEditorInvitationMessage("unavailable")}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
