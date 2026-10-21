import { eq, sql } from "drizzle-orm";
import * as schema from "../src/schema";
import { normalizeEmail, openProvisioningDatabase, parseUniversityIdentifier } from "./_provisioning";

async function main() {
  const email = normalizeEmail(process.argv[2]);
  const universityIdentifier = parseUniversityIdentifier(process.argv[3]);
  const { db, pool } = openProvisioningDatabase();
  let createdId: string;

  try {
    createdId = await db.transaction(async (tx) => {
      const universityCondition = universityIdentifier.kind === "id"
        ? eq(schema.universities.id, universityIdentifier.value)
        : eq(schema.universities.slug, universityIdentifier.value);
      const [university] = await tx.select({ id: schema.universities.id })
        .from(schema.universities)
        .where(universityCondition)
        .limit(1);
      if (!university) throw new Error("Université introuvable.");

      const [existingUser] = await tx.select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = ${email}`)
        .limit(1);
      if (existingUser) throw new Error("Un compte existe déjà.");

      const [created] = await tx.insert(schema.users).values({
        email,
        role: "university_admin",
        universityId: university.id,
      }).returning({ id: schema.users.id });
      if (!created) throw new Error("Création impossible.");
      return created.id;
    });
  } finally {
    await pool.end();
  }

  console.log(createdId);
}

main().catch(() => {
  console.error("Provisionnement refusé.");
  process.exitCode = 1;
});
