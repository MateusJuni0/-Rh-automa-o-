import { cookies } from "next/headers";
import { sessionFromCookies } from "./api";
import { DEV_AGENCY_ID } from "./db";
import { DEV_RECRUITER_ID } from "./vagas";

export type Session = { agencyId: string; recruiterId: string };

/**
 * Sessão da app (single-tenant IRIS). Lê dos cookies (via `sessionFromCookies`); o middleware já
 * garante a sessão (páginas→/login, /api→401), por isso o fallback do seed (IRIS/Filipa) é só a
 * rede de segurança. É o ÚNICO ponto onde rotas/pages obtêm a identidade — as libs recebem
 * `agencyId` por parâmetro (NUNCA do cliente).
 *
 * TODO(KEYS): trocar por `@supabase/ssr` (Supabase Auth) quando a chave/serviço chegar — login real =
 * email/senha OU biometria (`services/face` enroll → passwordless). Ver KEYS-TODO.md.
 */
export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const session = sessionFromCookies((n) => jar.get(n)?.value);
  if (session) {
    return session;
  }
  // O middleware já garante a sessão; o fallback DEV é só dev/teste. Em produção, sem sessão = erro
  // ruidoso (nunca deve acontecer) — não silenciar como Filipa.
  if (process.env.NODE_ENV === "production") {
    throw new Error("getSession: sem sessão em produção");
  }
  return { agencyId: DEV_AGENCY_ID, recruiterId: DEV_RECRUITER_ID };
}
