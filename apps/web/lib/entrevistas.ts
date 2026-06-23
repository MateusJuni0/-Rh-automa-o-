import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, asc, desc, eq } from "drizzle-orm";

type Db = DbHandle["db"];

/** Resumo de uma entrevista do candidato (para a lista no detalhe do candidato). */
export interface EntrevistaResumo {
  id: string;
  status: string; // scheduled | live | done | unstructured
  startedAt: Date | null;
  endedAt: Date | null;
  jobTitle: string | null;
}

/** Entrevistas de um candidato, mais recentes primeiro. */
export async function getEntrevistasDoCandidato(
  db: Db,
  agencyId: string,
  candidateId: string,
): Promise<EntrevistaResumo[]> {
  return db
    .select({
      id: schema.interview.id,
      status: schema.interview.status,
      startedAt: schema.interview.startedAt,
      endedAt: schema.interview.endedAt,
      jobTitle: schema.job.title,
    })
    .from(schema.interview)
    .leftJoin(schema.process, eq(schema.process.id, schema.interview.processId))
    .leftJoin(schema.job, eq(schema.job.id, schema.process.jobId))
    .where(
      and(eq(schema.interview.agencyId, agencyId), eq(schema.interview.candidateId, candidateId)),
    )
    .orderBy(desc(schema.interview.startedAt));
}

/** Uma fala da transcrição, com flag se está implicada numa contradição (Verdade vs CV). */
export interface TranscriptLinha {
  seq: number;
  speaker: string; // candidate | recruiter | client | other
  speakerLabel: string | null;
  ts: string;
  text: string;
  contradiz: boolean;
}

export interface ContradicaoView {
  requisito: string | null;
  detalhe: string | null;
  tipo: string; // vs_cv | interno
}

export interface FactoView {
  competencia: string;
  factText: string;
  evidenceTs: string | null;
  rubricLevel: string | null;
  factType: string;
}

export interface EntrevistaTranscript {
  id: string;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  candidateId: string | null;
  candidateName: string | null;
  jobTitle: string | null;
  linhas: TranscriptLinha[];
  contradicoes: ContradicaoView[];
  factos: FactoView[];
}

/**
 * Transcrição completa de uma entrevista (Tela "Entrevista"): meta + falas diarizadas por `seq`,
 * contradições vs CV ancoradas à fala, e os factos destilados desse processo. Tudo lido da DB
 * (Camada A), sem achismo — cada fala tem falante + minuto.
 */
export async function getEntrevistaTranscript(
  db: Db,
  agencyId: string,
  interviewId: string,
): Promise<EntrevistaTranscript | null> {
  const [meta] = await db
    .select({
      id: schema.interview.id,
      status: schema.interview.status,
      startedAt: schema.interview.startedAt,
      endedAt: schema.interview.endedAt,
      processId: schema.interview.processId,
      candidateId: schema.interview.candidateId,
      candidateName: schema.candidate.name,
      jobTitle: schema.job.title,
    })
    .from(schema.interview)
    .leftJoin(schema.candidate, eq(schema.candidate.id, schema.interview.candidateId))
    .leftJoin(schema.process, eq(schema.process.id, schema.interview.processId))
    .leftJoin(schema.job, eq(schema.job.id, schema.process.jobId))
    .where(and(eq(schema.interview.id, interviewId), eq(schema.interview.agencyId, agencyId)))
    .limit(1);

  if (!meta) {
    return null;
  }

  const chunks = await db
    .select({
      id: schema.transcriptChunk.id,
      seq: schema.transcriptChunk.seq,
      speaker: schema.transcriptChunk.speaker,
      speakerLabel: schema.transcriptChunk.speakerLabel,
      ts: schema.transcriptChunk.tsStart,
      text: schema.transcriptChunk.text,
    })
    .from(schema.transcriptChunk)
    .where(
      and(
        eq(schema.transcriptChunk.interviewId, interviewId),
        eq(schema.transcriptChunk.agencyId, agencyId),
      ),
    )
    .orderBy(asc(schema.transcriptChunk.seq));

  const contraRows = meta.processId
    ? await db
        .select({
          requisito: schema.contradiction.requisito,
          detalhe: schema.contradiction.detalhe,
          tipo: schema.contradiction.tipo,
          chunkA: schema.contradiction.chunkA,
          chunkB: schema.contradiction.chunkB,
        })
        .from(schema.contradiction)
        .where(
          and(
            eq(schema.contradiction.agencyId, agencyId),
            eq(schema.contradiction.processId, meta.processId),
          ),
        )
    : [];

  const factRows = meta.processId
    ? await db
        .select({
          competencia: schema.candidateMemoryFact.competencia,
          factText: schema.candidateMemoryFact.factText,
          evidenceTs: schema.candidateMemoryFact.evidenceTs,
          rubricLevel: schema.candidateMemoryFact.rubricLevel,
          factType: schema.candidateMemoryFact.factType,
        })
        .from(schema.candidateMemoryFact)
        .where(
          and(
            eq(schema.candidateMemoryFact.agencyId, agencyId),
            eq(schema.candidateMemoryFact.processId, meta.processId),
          ),
        )
        .orderBy(desc(schema.candidateMemoryFact.createdAt))
    : [];

  const chunksImplicados = new Set<string>();
  for (const c of contraRows) {
    if (c.chunkA) {
      chunksImplicados.add(c.chunkA);
    }
    if (c.chunkB) {
      chunksImplicados.add(c.chunkB);
    }
  }

  return {
    id: meta.id,
    status: meta.status,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    candidateId: meta.candidateId,
    candidateName: meta.candidateName,
    jobTitle: meta.jobTitle,
    linhas: chunks.map((c) => ({
      seq: c.seq,
      speaker: c.speaker,
      speakerLabel: c.speakerLabel,
      ts: c.ts,
      text: c.text,
      contradiz: chunksImplicados.has(c.id),
    })),
    contradicoes: contraRows.map((c) => ({
      requisito: c.requisito,
      detalhe: c.detalhe,
      tipo: c.tipo,
    })),
    factos: factRows,
  };
}

/** Item da lista global de entrevistas (todas as entrevistas da agência). */
export interface EntrevistaListItem {
  id: string;
  status: string;
  startedAt: Date | null;
  candidateId: string | null;
  candidateName: string | null;
  jobTitle: string | null;
}

/** Todas as entrevistas da agência, mais recentes primeiro (para a página /entrevistas). */
export async function listEntrevistas(db: Db, agencyId: string): Promise<EntrevistaListItem[]> {
  return db
    .select({
      id: schema.interview.id,
      status: schema.interview.status,
      startedAt: schema.interview.startedAt,
      candidateId: schema.interview.candidateId,
      candidateName: schema.candidate.name,
      jobTitle: schema.job.title,
    })
    .from(schema.interview)
    .leftJoin(schema.candidate, eq(schema.candidate.id, schema.interview.candidateId))
    .leftJoin(schema.process, eq(schema.process.id, schema.interview.processId))
    .leftJoin(schema.job, eq(schema.job.id, schema.process.jobId))
    .where(eq(schema.interview.agencyId, agencyId))
    .orderBy(desc(schema.interview.startedAt));
}
