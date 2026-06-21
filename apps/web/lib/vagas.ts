import { randomUUID } from "node:crypto";
import { extractJobRequirements } from "@rh/ai";
import { type JobRequirements, jobRequirements } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { aiOptions } from "./ai";
import { heuristicRequirements } from "./cv-heuristics";

type Db = DbHandle["db"];

/** Recrutadora por defeito (= Filipa do seed) até a auth dar o utilizador (Fase H). */
export const DEV_RECRUITER_ID = "22222222-0000-4000-8000-000000000001";

export interface NewVaga {
  clientId: string;
  title: string;
  roleTypeSlug?: string;
  /** Texto/documento do cliente — o cérebro extrai os requisitos estruturados. */
  requirementsText: string;
}

/** Requisitos de fallback (sem chave de IA): deteção determinística por palavra-chave do texto. */
function stubRequirements(input: NewVaga): JobRequirements {
  return heuristicRequirements(input.requirementsText, input.roleTypeSlug);
}

/** Cria uma vaga, extraindo os requisitos do texto via `@rh/ai` (real com chave; stub sem). */
export async function createVaga(
  db: Db,
  agencyId: string,
  input: NewVaga,
  recruiterId: string = DEV_RECRUITER_ID,
): Promise<{ id: string; requirements: JobRequirements }> {
  const requirements = await extractJobRequirements(
    input.requirementsText,
    aiOptions(stubRequirements(input)),
  );
  const id = randomUUID();
  await db.insert(schema.job).values({
    id,
    agencyId,
    clientId: input.clientId,
    recruiterId,
    title: input.title,
    roleTypeSlug: requirements.roleType,
    requirements,
  });
  return { id, requirements };
}

export interface VagaRow {
  id: string;
  title: string;
  roleTypeSlug: string;
  clientName: string | null;
  clientLogoUrl: string | null;
  numCandidatos: number;
  nivel: string;
  must: string[];
}

/** Vagas da agência, com o CLIENTE (nome+logo), nível, must-haves e nº de candidatos no funil. */
export async function listVagas(db: Db, agencyId: string): Promise<VagaRow[]> {
  const rows = await db
    .select({
      id: schema.job.id,
      title: schema.job.title,
      roleTypeSlug: schema.job.roleTypeSlug,
      requirements: schema.job.requirements,
      clientName: schema.client.name,
      clientLogoUrl: schema.client.logoUrl,
      numCandidatos: count(schema.process.id),
    })
    .from(schema.job)
    .leftJoin(schema.client, eq(schema.client.id, schema.job.clientId))
    .leftJoin(
      schema.process,
      and(eq(schema.process.jobId, schema.job.id), isNull(schema.process.deletedAt)),
    )
    .where(and(eq(schema.job.agencyId, agencyId), isNull(schema.job.deletedAt)))
    .groupBy(schema.job.id, schema.client.id)
    .orderBy(desc(schema.job.createdAt));
  return rows.map((r) => {
    const parsed = jobRequirements.safeParse(r.requirements);
    const req = parsed.success ? parsed.data : EMPTY_REQUIREMENTS;
    return {
      id: r.id,
      title: r.title,
      roleTypeSlug: r.roleTypeSlug,
      clientName: r.clientName,
      clientLogoUrl: r.clientLogoUrl,
      numCandidatos: r.numCandidatos,
      nivel: req.nivel,
      must: req.skills.must,
    };
  });
}

export interface VagaCandidato {
  candidateId: string;
  name: string;
  stage: string;
}

/** Candidatos NO funil desta vaga (processos), com a etapa. Para o detalhe da vaga. */
export function listVagaCandidatos(
  db: Db,
  agencyId: string,
  jobId: string,
): Promise<VagaCandidato[]> {
  return db
    .select({
      candidateId: schema.candidate.id,
      name: schema.candidate.name,
      stage: schema.process.stage,
    })
    .from(schema.process)
    .innerJoin(schema.candidate, eq(schema.candidate.id, schema.process.candidateId))
    .where(
      and(
        eq(schema.process.jobId, jobId),
        eq(schema.process.agencyId, agencyId),
        isNull(schema.process.deletedAt),
      ),
    )
    .orderBy(desc(schema.process.createdAt));
}

export interface VagaCriterio {
  criterio: string;
  peso: string; // must | normal | nice
}

export interface VagaDetail {
  id: string;
  title: string;
  roleTypeSlug: string;
  clientId: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
  clientSector: string | null;
  clientLocation: string | null;
  requirements: JobRequirements;
  /** Critérios que o cliente pede sempre (rubric herdada da ficha do cliente). */
  clientCriterios: VagaCriterio[];
}

const EMPTY_REQUIREMENTS: JobRequirements = {
  roleType: "",
  nivel: "",
  skills: { must: [], nice: [] },
  contexto: "",
};

/** Detalhe da vaga (Tela 2): valida os requisitos JSONB na fronteira (não confia no shape da DB). */
export async function getVaga(db: Db, agencyId: string, id: string): Promise<VagaDetail | null> {
  const [row] = await db
    .select({
      id: schema.job.id,
      title: schema.job.title,
      roleTypeSlug: schema.job.roleTypeSlug,
      requirements: schema.job.requirements,
      clientId: schema.client.id,
      clientName: schema.client.name,
      clientLogoUrl: schema.client.logoUrl,
      clientSector: schema.client.sector,
      clientLocation: schema.client.location,
    })
    .from(schema.job)
    .leftJoin(schema.client, eq(schema.client.id, schema.job.clientId))
    .where(
      and(eq(schema.job.id, id), eq(schema.job.agencyId, agencyId), isNull(schema.job.deletedAt)),
    );
  if (!row) {
    return null;
  }
  const parsed = jobRequirements.safeParse(row.requirements);
  const clientCriterios: VagaCriterio[] = row.clientId
    ? await db
        .select({
          criterio: schema.clientCriteria.criterio,
          peso: schema.clientCriteria.peso,
        })
        .from(schema.clientCriteria)
        .where(
          and(
            eq(schema.clientCriteria.clientId, row.clientId),
            eq(schema.clientCriteria.agencyId, agencyId),
            isNull(schema.clientCriteria.deletedAt),
          ),
        )
    : [];
  return {
    id: row.id,
    title: row.title,
    roleTypeSlug: row.roleTypeSlug,
    clientId: row.clientId,
    clientName: row.clientName,
    clientLogoUrl: row.clientLogoUrl,
    clientSector: row.clientSector,
    clientLocation: row.clientLocation,
    requirements: parsed.success ? parsed.data : EMPTY_REQUIREMENTS,
    clientCriterios,
  };
}
