export const instant = false;

import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema, eq, createOauthTransferCode, deleteStudentSession } from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { authOptions } from "@/lib/auth";
import { getTenantReturnUrl } from "@/lib/tenant-return-url.mjs";
import { buildTransferRedirectUrl } from "@/lib/auth-central-transfer.mjs";

export default async function TransferPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.universityId) {
    redirect("/auth-central/signin");
  }

  const universityId = session.user.universityId;
  const userId = session.user.id;

  let slug: string | null = null;
  try {
    const rows = await db
      .select({ slug: schema.universities.slug })
      .from(schema.universities)
      .where(eq(schema.universities.id, universityId))
      .limit(1);
    if (rows.length > 0) slug = rows[0].slug;
  } catch {
    redirect("/auth-central/signin");
  }
  if (!slug) redirect("/auth-central/signin");

  // Valide ROOT_DOMAIN et l'URL de retour AVANT de créer le code
  // et AVANT de révoquer la session.
  const rootDomain = process.env.ROOT_DOMAIN;
  if (!rootDomain) redirect("/auth-central/signin");

  const secure = process.env.NODE_ENV === "production";
  const baseUrl = getTenantReturnUrl({ slug, rootDomain, secure });
  if (baseUrl === null) redirect("/auth-central/signin");

  // Crée le code de transfert.
  let code: string;
  try {
    code = await createOauthTransferCode({ universityId, userId });
  } catch {
    redirect("/auth-central/signin");
  }

  // Révoque la session centrale APRÈS création du code et validation de l'URL.
  // Échec de révocation = erreur générique, sans log de secret.
  const cookieStore = await cookies();
  const config = getSessionCookieConfig("web");
  const token = cookieStore.get(config.name)?.value;
  if (token) {
    try {
      await deleteStudentSession(token);
    } catch {
      redirect("/auth-central/signin");
    }
  }
  cookieStore.set(config.name, "", { ...config.options, maxAge: 0 });

  // Construit l'URL finale avec le code et redirige.
  const redirectUrl = buildTransferRedirectUrl({ slug, rootDomain, secure, code });
  if (redirectUrl === null) redirect("/auth-central/signin");

  redirect(redirectUrl);
}
