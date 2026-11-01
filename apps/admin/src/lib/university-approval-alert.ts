import "server-only";

import { db, eq, schema } from "@tablino/db";
import { sendUniversityApprovalAlertEmail } from "@tablino/email";
import { resolveApprovalsUrl } from "./approval-alert-url.mjs";

export { resolveApprovalsUrl };

export async function notifySuperAdminOfPendingUniversity(userId: string): Promise<void> {
  const alertEmail = process.env.SUPER_ADMIN_ALERT_EMAIL?.trim();
  if (!alertEmail) return;

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

    if (
      user?.role === "university_admin"
      && user.emailVerified !== null
      && user.universityStatus === "pending"
      && user.universityName
    ) {
      const approvalsUrl = resolveApprovalsUrl(process.env.NEXTAUTH_URL);

      await sendUniversityApprovalAlertEmail(
        alertEmail,
        {
          name: user.universityName,
          acronym: user.universityAcronym,
        },
        approvalsUrl,
      );
    }
  } catch {
    // try/catch complet, ne lève jamais, ne logue aucune valeur
  }
}
