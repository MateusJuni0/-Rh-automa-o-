import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, desc, eq, isNull } from "drizzle-orm";

type Db = DbHandle["db"];

export interface PipelineCard {
  processId: string;
  stage: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
}

/**
 * Pipeline da agência (Tela 1): processos (candidaturas) com nome do candidato + título da vaga.
 * A UI agrupa por `stage`. Isolado por agency; exclui apagados.
 */
export async function listPipeline(db: Db, agencyId: string): Promise<PipelineCard[]> {
  return db
    .select({
      processId: schema.process.id,
      stage: schema.process.stage,
      candidateId: schema.candidate.id,
      candidateName: schema.candidate.name,
      jobTitle: schema.job.title,
    })
    .from(schema.process)
    .innerJoin(schema.candidate, eq(schema.candidate.id, schema.process.candidateId))
    .innerJoin(schema.job, eq(schema.job.id, schema.process.jobId))
    .where(and(eq(schema.process.agencyId, agencyId), isNull(schema.process.deletedAt)))
    .orderBy(desc(schema.process.createdAt));
}
