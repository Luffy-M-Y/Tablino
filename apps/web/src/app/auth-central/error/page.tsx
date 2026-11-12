export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema, eq } from "@tablino/db";
import { AUTH_TRANSACTION_COOKIE_NAME } from "@/lib/auth-central-start.mjs";
import { verifyAuthTransaction } from "@/lib/auth-transaction.mjs";
import { resolveErrorRedirect } from "@/lib/auth-central-error-decision.mjs";
import { AuthShell, authCardClass, mutedClass } from "@/components/ui/kit";

export default async function AuthCentralErrorPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_TRANSACTION_COOKIE_NAME)?.value ?? "";

  let universityId: string | null = null;
  try {
    universityId = raw
      ? verifyAuthTransaction(raw, { now: new Date(), secret: process.env.NEXTAUTH_SECRET })
      : null;
  } catch {
    universityId = null;
  }

  let slug: string | null = null;
  if (universityId) {
    try {
      const rows = await db
        .select({ slug: schema.universities.slug })
        .from(schema.universities)
        .where(eq(schema.universities.id, universityId))
        .limit(1);
      if (rows.length > 0) slug = rows[0].slug;
    } catch {
      // slug reste null
    }
  }

  const rootDomain = process.env.ROOT_DOMAIN;
  const decision = resolveErrorRedirect({
    universityId,
    slug,
    rootDomain,
    secure: process.env.NODE_ENV === "production",
  });

  // redirect() hors de tout try/catch.
  if (decision.action === "redirect") {
    redirect(decision.url);
  }

  return (
    <AuthShell title="Erreur de connexion">
      <div className={authCardClass}>
        <p className={`text-sm ${mutedClass}`}>
          La connexion a &eacute;chou&eacute;. R&eacute;essayez depuis votre universit&eacute;.
        </p>
      </div>
    </AuthShell>
  );
}
