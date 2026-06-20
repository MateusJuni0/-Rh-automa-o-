import { type DbHandle, schema } from "@rh/db";
import { and, eq } from "drizzle-orm";

/**
 * Posse REAL da entrevista (1b): `SELECT 1 FROM interview WHERE id=$1 AND recruiter_id=$2`.
 * `recruiterId` = `sub` do JWT (verificado a montante por `createWsAuthenticate`).
 *
 * Vive SÓ no entrypoint da app (`@rh/db` é dep da app) — a lib `@rh/ws` (index.ts) fica sem @rh/db;
 * a query é injetada no handshake via `verifyOwnership`. Mantém o contrato de `@rh/core` intacto.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function dbVerifyOwnership(
  db: DbHandle["db"],
): (interviewId: string, recruiterId: string) => Promise<boolean> {
  return async (interviewId, recruiterId) => {
    // Guarda de formato: o `sub`/interviewId podem não ser UUID (token forjado) → nega sem
    // mandar um cast inválido ao Postgres (que lançaria erro em vez de devolver vazio).
    if (!UUID_RE.test(interviewId) || !UUID_RE.test(recruiterId)) {
      return false;
    }
    const rows = await db
      .select({ id: schema.interview.id })
      .from(schema.interview)
      .where(
        and(eq(schema.interview.id, interviewId), eq(schema.interview.recruiterId, recruiterId)),
      )
      .limit(1);
    return rows.length > 0;
  };
}
