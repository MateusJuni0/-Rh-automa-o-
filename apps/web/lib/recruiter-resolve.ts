import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { eq } from "drizzle-orm";
import type { Session } from "./session";

type Db = DbHandle["db"];

/**
 * Mapeia o `user.id` do Supabase Auth (auth.users) → recruiter (recruiter.userId) + a sua agência.
 * É a ponte entre a identidade do Auth e o tenant da app. Devolve `null` se o user não estiver
 * ligado a nenhum recruiter (ainda não provisionado) → o chamador trata como sem-sessão (fail-closed).
 */
export async function resolveSessionByUserId(db: Db, userId: string): Promise<Session | null> {
  const [row] = await db
    .select({
      recruiterId: schema.recruiter.id,
      agencyId: schema.recruiter.agencyId,
    })
    .from(schema.recruiter)
    .where(eq(schema.recruiter.userId, userId))
    .limit(1);
  if (!row) {
    return null;
  }
  return { agencyId: row.agencyId, recruiterId: row.recruiterId };
}
