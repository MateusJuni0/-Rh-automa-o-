import { randomUUID } from "node:crypto";
import { buildBriefing, buildRubric } from "@rh/ai";
import type { Briefing, RoleProfile, Rubric } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, eq, isNull } from "drizzle-orm";
import { aiOptions } from "./ai";
import { matchCandidatoVaga } from "./match";

type Db = DbHandle["db"];

const EMPTY_ROLE_PROFILE: RoleProfile = {
  competencias: [],
  oQueEBom: {},
  sinaisNivelErrado: [],
  linguagemFilipa: {},
  perguntasChave: [],
  sources: [],
};

/** Draft de rubric (SEM requisitoId — o sistema atribui) para o stub sem chave. */
function stubRubricDraft() {
  return {
    criteria: [
      {
        requisito: "(demo) competência principal",
        perguntaSonda: "Conta um caso real.",
        fraco: "não explica",
        ok: "explica superficialmente",
        forte: "explica com profundidade",
        linguagemFilipa: { fraco: "—", ok: "—", forte: "—" },
        peso: "must",
        origem: "role_profile",
        originCriteriaId: null,
        tipo: "competencia",
      },
    ],
  };
}

function stubBriefing() {
  return {
    perguntas: [
      {
        pergunta: "(demo — requer OPENROUTER_API_KEY) Conta um problema difícil que resolveste.",
        lente: "tecnica",
        boaResposta: "Descreve o problema, a decisão e o resultado.",
        requisitoId: null,
      },
    ],
  };
}

/**
 * Gera o briefing de uma vaga (PLANO P1.5): compila a rubric (atribui requisitoId §16F), persiste-a
 * (`rubric.job_id` UNIQUE), e gera o roteiro de perguntas ligado a esses ids.
 */
export async function generateBriefing(
  db: Db,
  agencyId: string,
  params: { jobId: string },
): Promise<{ rubric: Rubric; briefing: Briefing }> {
  const [job] = await db
    .select({ id: schema.job.id })
    .from(schema.job)
    .where(and(eq(schema.job.id, params.jobId), eq(schema.job.agencyId, agencyId)));
  if (!job) {
    throw new Error("vaga inexistente nesta agência");
  }

  const rubric = await buildRubric(
    { roleProfile: EMPTY_ROLE_PROFILE, clientCriteria: [] },
    aiOptions(stubRubricDraft()),
  );

  await db
    .insert(schema.rubric)
    .values({
      id: randomUUID(),
      jobId: params.jobId,
      agencyId,
      criteria: rubric.criteria,
      version: rubric.version,
    })
    .onConflictDoNothing();

  const briefing = await buildBriefing(
    {
      roleProfile: EMPTY_ROLE_PROFILE,
      rubric: rubric.criteria.map((c) => ({ requisitoId: c.requisitoId, requisito: c.requisito })),
    },
    aiOptions(stubBriefing()),
  );

  return { rubric, briefing };
}

/** Contexto do briefing quando há um candidato em foco: nome + match% + processId (para iniciar). */
export interface BriefingContext {
  processId: string;
  candidateName: string;
  /** Score do match (stub determinístico = 50 sem chave). */
  matchScore: number;
}

/**
 * Resolve candidato×vaga para o topo do briefing. Lê o processo (candidatura já existente no funil)
 * e calcula o match. Sem `candidateId` (ou processo inexistente) → null (briefing genérico da vaga).
 */
export async function getBriefingContext(
  db: Db,
  agencyId: string,
  jobId: string,
  candidateId: string | undefined,
): Promise<BriefingContext | null> {
  if (!candidateId) {
    return null;
  }
  const [row] = await db
    .select({
      processId: schema.process.id,
      candidateName: schema.candidate.name,
    })
    .from(schema.process)
    .innerJoin(schema.candidate, eq(schema.candidate.id, schema.process.candidateId))
    .where(
      and(
        eq(schema.process.candidateId, candidateId),
        eq(schema.process.jobId, jobId),
        eq(schema.process.agencyId, agencyId),
        isNull(schema.process.deletedAt),
      ),
    )
    .limit(1);
  if (!row) {
    return null;
  }
  const { match } = await matchCandidatoVaga(db, agencyId, { candidateId, jobId });
  return {
    processId: row.processId,
    candidateName: row.candidateName,
    matchScore: match.matchScore,
  };
}
