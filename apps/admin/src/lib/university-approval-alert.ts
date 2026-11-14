import "server-only";

import { db, eq, schema } from "@tablino/db";
import { sendUniversityApprovalAlertEmail } from "@tablino/email";
import { resolveApprovalsUrl } from "./approval-alert-url.mjs";
import { sendWithRetry } from "./send-with-retry.mjs";

export { resolveApprovalsUrl };

export async function notifySuperAdminOfPendingUniversity(userId: string): Promise<void> {
  const alertEmail = process.env.SUPER_ADMIN_ALERT_EMAIL?.trim();
  if (!alertEmail) {
    console.warn("[alerte-universite] variable absente");
    return;
  }

  try {
    const [user] = await db
      .select({
        role: schema.users.role,
        emailVerified: schema.users.emailVerified,
        universityId: schema.users.universityId,
        universityName: schema.universities.name,
        universityAcronym: schema.universities.acronym,
        universityStatus: schema.universities.status,
      })
      .from(schema.users)
      .leftJoin(schema.universities, eq(schema.users.universityId, schema.universities.id))
      .where(eq(schema.users.id, userId))
      .limit(1);

    const hasRole = user?.role === "university_admin";
    const hasEmailVerified = Boolean(user && user.emailVerified !== null);
    const hasPendingStatus = user?.universityStatus === "pending";
    const universityName = user?.universityName?.trim();
    const hasUniversityName = Boolean(universityName);

    if (!hasRole || !hasEmailVerified || !hasPendingStatus || !universityName) {
      console.warn(
        `[alerte-universite] conditions non remplies (role: ${hasRole}, emailVerified: ${hasEmailVerified}, status: ${hasPendingStatus}, nom: ${hasUniversityName})`,
      );
      return;
    }

    const approvalsUrl = resolveApprovalsUrl({
      rootDomain: process.env.ADMIN_ROOT_DOMAIN,
      secure: process.env.NODE_ENV === "production",
    });
    if (approvalsUrl === null) {
      console.error("[alerte-universite] lien /approvals indisponible : ADMIN_ROOT_DOMAIN absent ou invalide.");
    }

    await sendWithRetry(() =>
      sendUniversityApprovalAlertEmail(
        alertEmail,
        {
          name: universityName,
          acronym: user?.universityAcronym,
        },
        approvalsUrl,
      ),
    );

    console.log("[alerte-universite] alerte envoyee");
  } catch (error: any) {
    const errorName = error?.name ?? "Error";
    const detail = error?.status ?? error?.cause?.code ?? error?.cause?.name ?? "inconnu";
    console.error(`[alerte-universite] echec apres essais (${errorName}, ${detail})`);
  }
}
