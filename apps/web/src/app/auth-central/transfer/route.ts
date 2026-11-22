import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { db, schema, eq, createOauthTransferCode, deleteStudentSession } from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { authOptions } from "@/lib/auth";
import { getTenantReturnUrl } from "@/lib/tenant-return-url.mjs";
import { buildTransferRedirectUrl } from "@/lib/auth-central-transfer.mjs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function refuse() {
  return new NextResponse(null, {
    status: 303,
    headers: { ...NO_STORE_HEADERS, Location: "/auth-central/signin" },
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.universityId) {
    return refuse();
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
    return refuse();
  }
  if (!slug) return refuse();

  // Valide ROOT_DOMAIN et l'URL de retour AVANT de créer le code
  // et AVANT de révoquer la session.
  const rootDomain = process.env.ROOT_DOMAIN;
  if (!rootDomain) return refuse();

  const secure = process.env.NODE_ENV === "production";
  const baseUrl = getTenantReturnUrl({ slug, rootDomain, secure });
  if (baseUrl === null) return refuse();

  // Crée le code de transfert.
  let code: string;
  try {
    code = await createOauthTransferCode({ universityId, userId });
  } catch {
    return refuse();
  }

  // Révoque la session centrale APRÈS création du code et validation de l'URL.
  // Échec de révocation = erreur générique, sans log de secret.
  const config = getSessionCookieConfig("web");
  const token = request.cookies.get(config.name)?.value;
  if (token) {
    try {
      await deleteStudentSession(token);
    } catch {
      return refuse();
    }
  }

  // Construit l'URL finale avec le code et redirige.
  const redirectUrl = buildTransferRedirectUrl({ slug, rootDomain, secure, code });
  if (redirectUrl === null) {
    const response = refuse();
    response.cookies.set(config.name, "", { ...config.options, maxAge: 0 });
    return response;
  }

  const response = NextResponse.redirect(new URL(redirectUrl), {
    status: 303,
    headers: NO_STORE_HEADERS,
  });
  response.cookies.set(config.name, "", { ...config.options, maxAge: 0 });
  return response;
}
