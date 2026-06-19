import { createDb, type DbHandle } from "@rh/db";

let handle: DbHandle | undefined;

/** Cliente Drizzle singleton (server-only). `DATABASE_URL` do ambiente — NUNCA hardcoded. */
export function getDb(): DbHandle["db"] {
  if (!handle) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL em falta");
    }
    handle = createDb(url);
  }
  return handle.db;
}

/**
 * v1 single-tenant: a agência é a IRIS (= `SEED_IDS.agency`). Substitui-se pela agência da
 * sessão de auth na Fase H. Até lá, todas as rotas operam sobre esta agência.
 */
export const DEV_AGENCY_ID = "11111111-0000-4000-8000-000000000001";
