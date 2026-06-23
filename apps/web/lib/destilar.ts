import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { indexCandidateFact } from "@rh/knowledge";
import { and, asc, eq } from "drizzle-orm";
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

export interface DistillResult {
  status: "done" | "already_done" | "not_found";
  jobId: string | null;
  factsCreated: number;
}

/** Texto mínimo de um chunk para virar facto (filtra ruído de muletas/curtos). */
const MIN_CHUNK_LEN = 12;

/**
 * Destilação-FINAL durável (MODELO-DADOS §16H, ARQUITETURA-TEMPO-REAL §11.1(5)): ao encerrar a
 * entrevista, lê a Camada A (`transcript_chunk` do candidato) → factos duráveis, regista um
 * `async_job kind='distill_final'` (running→done/failed) e seta `interview.distilled_at` — o GATE que
 * destrava a purga de áudio cru (`DATA-RETENTION §1.1`: áudio nunca purgado sem destilação completa).
 *
 * IDEMPOTENTE por entrevista via o gate `distilled_at` (re-correr não duplica factos). v1 mock: a
 * destilação é determinística (cada fala do candidato → facto com prova); o LLM real entra na Fase Ω.
 */
export async function distillFinal(
  db: Db,
  agencyId: string,
  interviewId: string,
): Promise<DistillResult> {
  const [iv] = await db
    .select({
      candidateId: schema.interview.candidateId,
      recruiterId: schema.interview.recruiterId,
      distilledAt: schema.interview.distilledAt,
    })
    .from(schema.interview)
    .where(and(eq(schema.interview.id, interviewId), eq(schema.interview.agencyId, agencyId)));
  if (!iv) {
    return { status: "not_found", jobId: null, factsCreated: 0 };
  }
  if (iv.distilledAt) {
    return { status: "already_done", jobId: null, factsCreated: 0 };
  }

  const jobId = randomUUID();
  await db.insert(schema.asyncJob).values({
    id: jobId,
    agencyId,
    recruiterId: iv.recruiterId,
    candidateId: iv.candidateId,
    kind: "distill_final",
    status: "running",
    args: { interviewId },
  });

  try {
    const chunks = await db
      .select({
        speaker: schema.transcriptChunk.speaker,
        text: schema.transcriptChunk.text,
        tsStart: schema.transcriptChunk.tsStart,
      })
      .from(schema.transcriptChunk)
      .where(eq(schema.transcriptChunk.interviewId, interviewId))
      .orderBy(asc(schema.transcriptChunk.seq));

    let factsCreated = 0;
    // Órfã sem candidato (cold-start §12): seta o gate na mesma, mas não há a quem creditar factos.
    if (iv.candidateId) {
      for (const c of chunks) {
        if (c.speaker !== "candidate" || c.text.trim().length < MIN_CHUNK_LEN) {
          continue;
        }
        await destilarFacto(db, agencyId, {
          candidateId: iv.candidateId,
          competencia: "Entrevista",
          factText: c.text,
          evidenceQuote: c.text,
          evidenceTs: c.tsStart,
          speaker: "candidate",
          factType: "statement",
        });
        factsCreated++;
      }
    }

    // GATE da purga de áudio: só depois de a destilação ter corrido.
    await db
      .update(schema.interview)
      .set({ distilledAt: new Date() })
      .where(and(eq(schema.interview.id, interviewId), eq(schema.interview.agencyId, agencyId)));
    await db
      .update(schema.asyncJob)
      .set({ status: "done", args: { interviewId, factsCreated } })
      .where(eq(schema.asyncJob.id, jobId));
    return { status: "done", jobId, factsCreated };
  } catch (e) {
    await db
      .update(schema.asyncJob)
      .set({ status: "failed", args: { interviewId, error: String(e).slice(0, 300) } })
      .where(eq(schema.asyncJob.id, jobId));
    throw e;
  }
}
