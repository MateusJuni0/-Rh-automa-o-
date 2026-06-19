import { randomUUID } from "node:crypto";
import { extractCandidateProfile } from "@rh/ai";
import type { CandidateProfile } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { aiOptions } from "./ai";

type Db = DbHandle["db"];

export interface NewCandidato {
  name: string;
  linkedinUrl?: string;
  /** Texto do CV — o cérebro extrai o perfil estruturado. */
  cvText: string;
}

/** Perfil canned quando não há chave — demo sem custo. */
function stubProfile(input: NewCandidato): CandidateProfile {
  return {
    skillsDeclaradas: [],
    experienciaAnos: null,
    gapsCv: [],
    resumo: input.cvText.slice(0, 300),
  };
}

/** Normaliza o nome (sem acentos, minúsculas) para dedup/resolução de entidade (§12). */
function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Cria um candidato GLOBAL, extraindo o perfil do CV via `@rh/ai` (real com chave; stub sem). */
export async function createCandidato(
  db: Db,
  agencyId: string,
  input: NewCandidato,
): Promise<{ id: string; profile: CandidateProfile }> {
  const profile = await extractCandidateProfile(input.cvText, aiOptions(stubProfile(input)));
  const id = randomUUID();
  await db.insert(schema.candidate).values({
    id,
    agencyId,
    name: input.name,
    linkedinUrl: input.linkedinUrl ?? null,
    nameNormalized: normalizeName(input.name),
    profile,
  });
  return { id, profile };
}

export interface CandidatoRow {
  id: string;
  name: string;
}

export function listCandidatos(db: Db, agencyId: string): Promise<CandidatoRow[]> {
  return db
    .select({ id: schema.candidate.id, name: schema.candidate.name })
    .from(schema.candidate)
    .where(and(eq(schema.candidate.agencyId, agencyId), isNull(schema.candidate.deletedAt)))
    .orderBy(desc(schema.candidate.createdAt));
}
