import { eq, sql } from "drizzle-orm";
import * as schema from "../src/schema";
import { hashPassword, isPasswordValid } from "../src/password";
import { normalizeEmail, openProvisioningDatabase } from "./_provisioning";
import { readHiddenPassword } from "./_hidden-password";

async function main() {
  const email = normalizeEmail(process.argv[2]);
  const password = await readHiddenPassword("Mot de passe super_admin : ");
  const confirmation = await readHiddenPassword("Confirmez le mot de passe : ");
  if (!isPasswordValid(password) || password !== confirmation) {
    throw new Error("Mot de passe invalide ou confirmation différente.");
  }
  const passwordHash = hashPassword(password);
  const { db, pool } = openProvisioningDatabase();
  let createdId: string;

  try {
    createdId = await db.transaction(async (tx) => {
      const [existingAdmin] = await tx.select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.role, "super_admin"))
        .limit(1);
      if (existingAdmin) throw new Error("Un super_admin existe déjà.");

      const [existingUser] = await tx.select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = ${email}`)
        .limit(1);
      if (existingUser) throw new Error("Un compte existe déjà.");

      const [created] = await tx.insert(schema.users).values({
        email,
        role: "super_admin",
        universityId: null,
        passwordHash,
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
