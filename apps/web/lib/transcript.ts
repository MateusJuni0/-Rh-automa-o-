import { createHash, randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { asc, desc, eq } from "drizzle-orm";

type Db = DbHandle["db"];

/**
 * Camada A (ARQUITETURA-TEMPO-REAL §8, MODELO-DADOS §2): persistência da transcrição — a FONTE DE
 * VERDADE do parecer/Q&A/destilação. Cada chunk leva um selo de não-repúdio (hash-chain por
 * entrevista, §15.8): `content_hash = sha256(prev_hash | conteúdo canónico)`, `prev_hash` = hash do
 * chunk anterior (maior `seq`). Editar um chunk no Postgres quebra a cadeia (tamper-evident).
 * Sem chaves: o STT real (Soniox) alimenta isto na Fase Ω; aqui o write-path é determinístico.
 */
export interface NewChunk {
  interviewId: string;
  seq: number;
  speaker: string; // candidate | recruiter | client | other
  speakerLabel?: string | null;
  tsStart: string;
  tsEnd?: string | null;
  text: string;
  classificacao?: string; // professional | personal (§5 RGPD)
  isFinal?: boolean;
  sttConfidence?: number | null;
  speakerConfidence?: number | null;
  startMs?: number | null;
  endMs?: number | null;
  sourceStreamId?: string | null;
}

/** Conteúdo canónico do chunk (campos imutáveis, ordem fixa → determinístico) para o hash. */
function canonicalContent(c: {
  interviewId: string;
  seq: number;
  speaker: string;
  tsStart: string;
  text: string;
  classificacao: string;
}): string {
  return JSON.stringify({
    interviewId: c.interviewId,
    seq: c.seq,
    speaker: c.speaker,
    tsStart: c.tsStart,
    text: c.text,
    classificacao: c.classificacao,
  });
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Hash encadeado: liga ao chunk anterior (`prev`) → qualquer edição a meio quebra tudo a jusante. */
function chainHash(prevHash: string | null, content: string): string {
  return sha256(`${prevHash ?? ""}|${content}`);
}

export interface PersistedChunk {
  id: string;
  contentHash: string;
  prevHash: string | null;
}

/** Persiste um chunk da Camada A com selo de não-repúdio (hash-chain por entrevista). Isolado por agência. */
export async function persistChunk(
  db: Db,
  agencyId: string,
  input: NewChunk,
): Promise<PersistedChunk> {
  const [prev] = await db
    .select({ contentHash: schema.transcriptChunk.contentHash })
    .from(schema.transcriptChunk)
    .where(eq(schema.transcriptChunk.interviewId, input.interviewId))
    .orderBy(desc(schema.transcriptChunk.seq))
    .limit(1);
  const prevHash = prev?.contentHash ?? null;
  const classificacao = input.classificacao ?? "professional";
  const contentHash = chainHash(
    prevHash,
    canonicalContent({
      interviewId: input.interviewId,
      seq: input.seq,
      speaker: input.speaker,
      tsStart: input.tsStart,
      text: input.text,
      classificacao,
    }),
  );
  const id = randomUUID();
  await db.insert(schema.transcriptChunk).values({
    id,
    agencyId,
    interviewId: input.interviewId,
    seq: input.seq,
    speaker: input.speaker,
    speakerLabel: input.speakerLabel ?? null,
    tsStart: input.tsStart,
    tsEnd: input.tsEnd ?? null,
    text: input.text,
    classificacao,
    isFinal: input.isFinal ?? true,
    sttConfidence: input.sttConfidence ?? null,
    speakerConfidence: input.speakerConfidence ?? null,
    startMs: input.startMs ?? null,
    endMs: input.endMs ?? null,
    sourceStreamId: input.sourceStreamId ?? null,
    contentHash,
    prevHash,
  });
  return { id, contentHash, prevHash };
}

export interface ChainVerdict {
  ok: boolean;
  /** `seq` do primeiro chunk cuja prova de integridade falhou (null se a cadeia está íntegra). */
  brokenAtSeq: number | null;
  count: number;
}

/**
 * Verifica a cadeia tamper-evident de uma entrevista (SEGURANCA §13.b): recomputa cada `content_hash`
 * e confirma o encadeamento. Se alguém editou um `transcript_chunk` no Postgres, a cadeia parte.
 */
export async function verifyChunkChain(db: Db, interviewId: string): Promise<ChainVerdict> {
  const chunks = await db
    .select({
      interviewId: schema.transcriptChunk.interviewId,
      seq: schema.transcriptChunk.seq,
      speaker: schema.transcriptChunk.speaker,
      tsStart: schema.transcriptChunk.tsStart,
      text: schema.transcriptChunk.text,
      classificacao: schema.transcriptChunk.classificacao,
      contentHash: schema.transcriptChunk.contentHash,
      prevHash: schema.transcriptChunk.prevHash,
    })
    .from(schema.transcriptChunk)
    .where(eq(schema.transcriptChunk.interviewId, interviewId))
    .orderBy(asc(schema.transcriptChunk.seq));

  let prevHash: string | null = null;
  for (const c of chunks) {
    const expected = chainHash(prevHash, canonicalContent(c));
    if (c.prevHash !== prevHash || c.contentHash !== expected) {
      return { ok: false, brokenAtSeq: c.seq, count: chunks.length };
    }
    prevHash = c.contentHash;
  }
  return { ok: true, brokenAtSeq: null, count: chunks.length };
}
