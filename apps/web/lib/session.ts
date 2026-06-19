import { cookies } from "next/headers";
import { DEV_AGENCY_ID } from "./db";
import { DEV_RECRUITER_ID } from "./vagas";

export interface Session {
  agencyId: string;
  recruiterId: string;
}

/**
 * Sessão da app (single-tenant IRIS, Fase H). Lê de cookies se existirem; senão devolve a sessão
 * fixa do seed (IRIS / Filipa). É o ÚNICO ponto onde rotas/pages obtêm a identidade — as libs
 * continuam a receber `agencyId` por parâmetro.
 *
 * TODO(KEYS): trocar por `@supabase/ssr` (Supabase Auth) quando a chave/serviço chegar — login real =
 * email/senha OU biometria (`services/face` enroll → passwordless). Ver KEYS-TODO.md.
 */
export async function getSession(): Promise<Session> {
  const jar = await cookies();
  return {
    agencyId: jar.get("vera_agency")?.value ?? DEV_AGENCY_ID,
    recruiterId: jar.get("vera_recruiter")?.value ?? DEV_RECRUITER_ID,
  };
}
