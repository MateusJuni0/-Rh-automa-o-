import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { agencyId, createdAt, EMBEDDING_DIM, pk } from "./_shared";
import { interview } from "./interview";
import { document } from "./job";
import { process } from "./process";

/** Camada A — transcrição completa, diarizada, com timestamp. Fonte de verdade do parecer. */
export const transcriptChunk = pgTable(
  "transcript_chunk",
  {
    id: pk(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interview.id),
    agencyId: agencyId(),
    seq: integer("seq").notNull(),
    speaker: text("speaker").notNull(), // candidate|recruiter|client|other (§13)
    speakerLabel: text("speaker_label"), // nome do participante (N pessoas)
    speakerCorrected: boolean("speaker_corrected").notNull().default(false),
    tsStart: text("ts_start").notNull(),
    tsEnd: text("ts_end"),
    text: text("text").notNull(),
    classificacao: text("classificacao").notNull().default("professional"), // §5 RGPD
    retainUntil: timestamp("retain_until", { withTimezone: true }),
    // §10 qualidade STT + diarização
    isFinal: boolean("is_final").notNull().default(true),
    sttConfidence: real("stt_confidence"),
    speakerConfidence: real("speaker_confidence"),
    audioGapMs: integer("audio_gap_ms"),
    startMs: integer("start_ms"),
    endMs: integer("end_ms"),
    sourceStreamId: text("source_stream_id"), // reconexão = novo stream
    providerSegmentId: text("provider_segment_id"),
    // §15.8 selo de não-repúdio (hash-chain por interview)
    contentHash: text("content_hash"),
    prevHash: text("prev_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("transcript_chunk_interview_idx").on(t.interviewId, t.seq)],
);

/** Embedding do chunk (pgvector). */
export const transcriptChunkEmbedding = pgTable(
  "transcript_chunk_embedding",
  {
    id: pk(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => transcriptChunk.id, { onDelete: "cascade" }),
    agencyId: agencyId(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }).notNull(),
  },
  (t) => [index("tce_embedding_idx").using("ivfflat", t.embedding.op("vector_cosine_ops"))],
);

/** Inconsistência durável, citada dos DOIS lados (§13). process_id nullable na fase órfã (§16M). */
export const contradiction = pgTable("contradiction", {
  id: pk(),
  agencyId: agencyId(),
  processId: uuid("process_id").references(() => process.id), // nullable: balde provisório da órfã
  requisito: text("requisito"), // display
  requisitoId: uuid("requisito_id"), // §16F chave canónica
  tipo: text("tipo").notNull(), // vs_cv|interno
  chunkA: uuid("chunk_a").references(() => transcriptChunk.id),
  chunkB: uuid("chunk_b").references(() => transcriptChunk.id), // NULL se vs CV
  cvDocumentId: uuid("cv_document_id").references(() => document.id), // §16C contra QUAL CV
  divergenceOrigin: text("divergence_origin"), // candidate|vera_generated (este exclui-se da mentira)
  detalhe: text("detalhe"),
  createdAt: createdAt(),
});
