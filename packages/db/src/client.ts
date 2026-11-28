import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { buildPoolConfig, handleIdlePoolError } from "./pool-config";
import * as schema from "./schema";

// Hors production, le rechargement à chaud réévalue ce module : le pool est gardé
// sur globalThis pour ne pas ouvrir un nouveau pool (et ses connexions) à chaque fois.
const globalForPool = globalThis as typeof globalThis & { __tablinoPool?: Pool };

function createPool(): Pool {
  const created = new Pool(buildPoolConfig(process.env));
  created.on("error", (error) => handleIdlePoolError(error));
  return created;
}

export const pool = globalForPool.__tablinoPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForPool.__tablinoPool = pool;

export const db = drizzle(pool, { schema });
