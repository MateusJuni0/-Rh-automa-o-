import { randomUUID } from "node:crypto";
import { extractCandidateProfile } from "@rh/ai";
import { type CandidateProfile, candidateProfile } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { aiOptions } from "./ai";
import { heuristicProfile } from "./cv-heuristics";

type Db = DbHandle["db"];

export interface NewCandidato {
  name: string;
  linkedinUrl?: string;
  /** Texto do CV — o cérebro extrai o perfil estruturado. */
  cvText: string;
}

/** Perfil de fallback (sem chave de IA): deteção determinística por palavra-chave do CV. */
function stubProfile(input: NewCandidato): CandidateProfile {
  return heuristicProfile(input.cvText);
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
  // Guarda o texto bruto do CV para poder mostrá-lo no perfil sem re-upload.
  if (input.cvText.length > 0) {
    await db.insert(schema.sourceDoc).values({
      id: randomUUID(),
      agencyId,
      kind: "cv",
      candidateId: id,
      rawText: input.cvText,
      title: `CV — ${input.name}`,
    });
  }
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

export interface CandidatoDetail {
  id: string;
  name: string;
  linkedinUrl: string | null;
  profile: CandidateProfile;
  cvText: string | null;
}

const EMPTY_PROFILE: CandidateProfile = {
  skillsDeclaradas: [],
  experienciaAnos: null,
  gapsCv: [],
  resumo: "",
};

export interface ProcessoAtivo {
  processId: string;
  jobId: string;
  jobTitle: string;
  clientName: string | null;
  stage: string;
}

/** Processos ativos de um candidato — vagas em que está e em que fase (para o detalhe do candidato). */
export async function getCandidatoProcessos(
  db: Db,
  agencyId: string,
  candidateId: string,
): Promise<ProcessoAtivo[]> {
  return db
    .select({
      processId: schema.process.id,
      jobId: schema.job.id,
      jobTitle: schema.job.title,
      clientName: schema.client.name,
      stage: schema.process.stage,
    })
    .from(schema.process)
    .innerJoin(schema.job, eq(schema.job.id, schema.process.jobId))
    .leftJoin(schema.client, eq(schema.client.id, schema.job.clientId))
    .where(
      and(
        eq(schema.process.candidateId, candidateId),
        eq(schema.process.agencyId, agencyId),
        isNull(schema.process.deletedAt),
        isNull(schema.job.deletedAt),
      ),
    )
    .orderBy(desc(schema.process.createdAt));
}

/** Detalhe do candidato (Tela 4): valida o perfil JSONB na fronteira (não confia no shape da DB). */
export async function getCandidato(
  db: Db,
  agencyId: string,
  id: string,
): Promise<CandidatoDetail | null> {
  const [[row], cvRows] = await Promise.all([
    db
      .select({
        id: schema.candidate.id,
        name: schema.candidate.name,
        linkedinUrl: schema.candidate.linkedinUrl,
        profile: schema.candidate.profile,
      })
      .from(schema.candidate)
      .where(
        and(
          eq(schema.candidate.id, id),
          eq(schema.candidate.agencyId, agencyId),
          isNull(schema.candidate.deletedAt),
        ),
      ),
    db
      .select({ rawText: schema.sourceDoc.rawText })
      .from(schema.sourceDoc)
      .where(and(eq(schema.sourceDoc.candidateId, id), eq(schema.sourceDoc.kind, "cv")))
      .orderBy(desc(schema.sourceDoc.fetchedAt))
      .limit(1),
  ]);
  if (!row) {
    return null;
  }
  const parsed = candidateProfile.safeParse(row.profile);
  return {
    id: row.id,
    name: row.name,
    linkedinUrl: row.linkedinUrl,
    profile: parsed.success ? parsed.data : EMPTY_PROFILE,
    cvText: cvRows[0]?.rawText ?? null,
  };
}
