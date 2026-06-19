import { randomUUID } from "node:crypto";
import { matchCandidate } from "@rh/ai";
import type { MatchResult, RoleProfile } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, eq } from "drizzle-orm";
import { aiOptions } from "./ai";
import { DEV_RECRUITER_ID } from "./vagas";

type Db = DbHandle["db"];

const EMPTY_ROLE_PROFILE: RoleProfile = {
  competencias: [],
  oQueEBom: {},
  sinaisNivelErrado: [],
  linguagemFilipa: {},
  perguntasChave: [],
  sources: [],
};

function stubMatch(): MatchResult {
  return {
    matchScore: 50,
    gapsAInvestigar: ["(demo — requer OPENROUTER_API_KEY)"],
    pontosFortes: [],
  };
}

export interface MatchParams {
  candidateId: string;
  jobId: string;
}

/**
 * Garante o `process` (candidatura candidate×job, UNIQUE) e corre o match (PLANO P1.4).
 * `roleProfile` fica vazio até o carril knowledge o preencher; o cérebro usa requirements+perfil.
 */
export async function matchCandidatoVaga(
  db: Db,
  agencyId: string,
  params: MatchParams,
): Promise<{ processId: string; match: MatchResult }> {
  await db
    .insert(schema.process)
    .values({
      id: randomUUID(),
      agencyId,
      candidateId: params.candidateId,
      jobId: params.jobId,
      recruiterId: DEV_RECRUITER_ID,
      stage: "screening",
    })
    .onConflictDoNothing();

  const [cand] = await db
    .select({ name: schema.candidate.name, profile: schema.candidate.profile })
    .from(schema.candidate)
    .where(
      and(eq(schema.candidate.id, params.candidateId), eq(schema.candidate.agencyId, agencyId)),
    );
  const [job] = await db
    .select({ requirements: schema.job.requirements })
    .from(schema.job)
    .where(and(eq(schema.job.id, params.jobId), eq(schema.job.agencyId, agencyId)));
  if (!cand || !job) {
    throw new Error("candidato ou vaga inexistente nesta agência");
  }

  const match = await matchCandidate(
    {
      candidate: { name: cand.name, profile: (cand.profile ?? {}) as Record<string, unknown> },
      roleProfile: EMPTY_ROLE_PROFILE,
      requirements: (job.requirements ?? {}) as Record<string, unknown>,
    },
    aiOptions(stubMatch()),
  );

  const [proc] = await db
    .select({ id: schema.process.id })
    .from(schema.process)
    .where(
      and(
        eq(schema.process.candidateId, params.candidateId),
        eq(schema.process.jobId, params.jobId),
      ),
    );

  return { processId: proc?.id ?? "", match };
}
