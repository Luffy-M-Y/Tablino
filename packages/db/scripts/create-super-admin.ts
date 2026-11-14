import { eq, sql } from "drizzle-orm";
import * as schema from "../src/schema";
import { hashPassword, isPasswordValid } from "../src/password";
import { normalizeEmail, openProvisioningDatabase } from "./_provisioning";

async function readHiddenPassword(prompt: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Un terminal interactif est requis pour saisir le mot de passe.");
  }

  process.stdout.write(prompt);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let password = "";
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      for (const character of text) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Saisie annulée."));
          return;
        }
        if (character === "\r") {
          cleanup();
          resolve(password);
          return;
        }
        if (character === "\n") continue;
        if (character === "\u007f" || character === "\b") {
          password = password.slice(0, -1);
        } else if (character >= " ") {
          password += character;
        }
      }
    };
    input.on("data", onData);
  });
}

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
