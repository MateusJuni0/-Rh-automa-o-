import { cookies } from "next/headers";
import { sessionFromCookies } from "./api";
import { devSessionAllowed } from "./auth-config";
import { DEV_AGENCY_ID, getDb } from "./db";
import { resolveSessionByUserId } from "./recruiter-resolve";
import { AUTH_ENABLED, createSupabaseServerClient } from "./supabase/server";
import { DEV_RECRUITER_ID } from "./vagas";

export type Session = { agencyId: string; recruiterId: string };

/**
 * Sessão da app (single-tenant IRIS). config-not-code:
 * - com Supabase Auth (`AUTH_ENABLED`): user do Supabase → recruiter+agência via DB (`recruiter.userId`).
 *   Sem user/recruiter → erro ruidoso (o middleware já redirecionou; aqui é defesa fail-closed).
 * - sem env: shim de cookie (`vera_agency`/`vera_recruiter`) — comportamento v1 atual (testes intactos).
 *
 * É o ÚNICO ponto onde rotas/pages obtêm a identidade — as libs recebem `agencyId` por parâmetro
 * (NUNCA do cliente).
 */
export async function getSession(): Promise<Session> {
  if (AUTH_ENABLED) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("getSession: sem sessão Supabase");
    }
    const session = await resolveSessionByUserId(getDb(), user.id);
    if (!session) {
      throw new Error("getSession: utilizador autenticado sem recruiter ligado");
    }
    return session;
  }

  const jar = await cookies();
  const session = sessionFromCookies((n) => jar.get(n)?.value);
  if (session) {
    return session;
  }
  // O middleware já garante a sessão; o fallback DEV de identidade (Filipa) só é permitido com a flag
  // EXPLÍCITA `ALLOW_DEV_SESSION` — NÃO se infere de `NODE_ENV` (um deploy mal-configurado em
  // `development` não deve ganhar uma sessão fantasma). Sem a flag → erro ruidoso (nunca silenciar).
  if (!devSessionAllowed()) {
    throw new Error("getSession: sem sessão e ALLOW_DEV_SESSION não está ativo");
  }
  return { agencyId: DEV_AGENCY_ID, recruiterId: DEV_RECRUITER_ID };
}
