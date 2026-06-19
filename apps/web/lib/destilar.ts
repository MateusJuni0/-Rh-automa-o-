import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { indexCandidateFact } from "@rh/knowledge";
import { getEmbedder } from "./embedder";

type Db = DbHandle["db"];

export interface DestilarFactoParams {
  candidateId: string;
  processId?: string;
  competencia: string;
  factText: string;
  evidenceQuote?: string;
  evidenceTs?: string;
  speaker?: string;
  factType?: string;
  rubricLevel?: "fraco" | "ok" | "forte";
  requisitoId?: string;
}

/**
 * Destila um facto durável do candidato (P3.x "Depois"): persiste em `candidate_memory_fact` e indexa-o
 * no RAG (`indexCandidateFact` + embedder). Devolve o factId. Embedder mock até à chave (KEYS-TODO).
 */
export async function destilarFacto(
  db: Db,
  agencyId: string,
  params: DestilarFactoParams,
): Promise<{ factId: string }> {
  const factId = randomUUID();
  await db.insert(schema.candidateMemoryFact).values({
    id: factId,
    candidateId: params.candidateId,
    agencyId,
    processId: params.processId,
    competencia: params.competencia,
    factText: params.factText,
    evidenceQuote: params.evidenceQuote,
    evidenceTs: params.evidenceTs,
    speaker: params.speaker,
    factType: params.factType ?? "statement",
    rubricLevel: params.rubricLevel,
    requisitoId: params.requisitoId,
  });
  await indexCandidateFact(db, { factId, agencyId, text: params.factText }, getEmbedder());
  return { factId };
}
