import { DEV_AGENCY_ID } from "./db";
import { DEV_RECRUITER_ID } from "./vagas";

/** 2.º recrutador IRIS (Inês). O seed da DB deve criar este recruiter (ver BUILD-LOG/seed). */
export const INES_RECRUITER_ID = "22222222-0000-4000-8000-000000000002";

export interface MockUser {
  agencyId: string;
  recruiterId: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Utilizadores seed da IRIS (single-tenant). MOCK: a verificação real de password é do Supabase Auth
 * (FASE Ω) — aqui NÃO se guarda password (zero segredos); exige-se só email seed + password não-vazia.
 */
const SEED_USERS: Record<string, MockUser> = {
  "filipa@iris.tech": { agencyId: DEV_AGENCY_ID, recruiterId: DEV_RECRUITER_ID, name: "Filipa" },
  "ines@iris.tech": { agencyId: DEV_AGENCY_ID, recruiterId: INES_RECRUITER_ID, name: "Inês" },
};

/** Login MOCK determinístico: email seed conhecido + password não-vazia → utilizador; senão `null`. */
export function verifyMockLogin(input: LoginInput): MockUser | null {
  if (input.password.length === 0) {
    return null;
  }
  const email = input.email.trim().toLowerCase();
  return SEED_USERS[email] ?? null;
}
