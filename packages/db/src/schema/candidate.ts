import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { agencyId, createdAt, deletedAt, EMBEDDING_DIM, pk } from "./_shared";
import { recruiter } from "./agency";
import { document } from "./job";
import { sourceDoc } from "./knowledge";
import { process } from "./process";

/** Candidato GLOBAL (talent pool, cross-cliente). Apagar = anonimizar (§6). */
export const candidate = pgTable(
  "candidate",
  {
    id: pk(),
    agencyId: agencyId(),
    name: text("name").notNull(),
    linkedinUrl: text("linkedin_url"),
    profile: jsonb("profile").notNull().default({}), // extraído do CV de referência
    email: text("email"), // §12 ALTO5 chaves de dedup/resolução de entidade
    phone: text("phone"),
    nameNormalized: text("name_normalized"),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }), // §6 apagar = anonimizar
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("candidate_name_norm_idx").on(t.agencyId, t.nameNormalized),
    index("candidate_email_idx").on(t.email),
  ],
);

/**
 * Factos do candidato (RAG durável). process_id é canónico (substitui job_id; NULL = facto geral).
 * Famílias: A (proveniência chunk→facto), F (requisito_id), L (veredito graduado), RGPD §5, §7 pesquisa.
 */
export const candidateMemoryFact = pgTable(
  "candidate_memory_fact",
  {
    id: pk(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidate.id),
    agencyId: agencyId(),
    processId: uuid("process_id").references(() => process.id), // canónico (NULL = geral, reutilizável)
    competencia: text("competencia").notNull(),
    factText: text("fact_text").notNull(),
    evidenceQuote: text("evidence_quote"),
    evidenceTs: text("evidence_ts"),
    speaker: text("speaker"), // candidate|recruiter|client
    factType: text("fact_type").notNull().default("statement"), // statement|skill_demo|gap
    // RGPD §5
    classificacao: text("classificacao").notNull().default("professional"),
    usarNoScore: boolean("usar_no_score").notNull().default(true),
    corrigidoPelaFilipa: boolean("corrigido_pela_filipa").notNull().default(false),
    correctedBy: uuid("corrected_by").references(() => recruiter.id),
    retainUntil: timestamp("retain_until", { withTimezone: true }),
    // §7 proveniência de pesquisa
    sourceType: text("source_type").notNull().default("interview"), // interview|research|cv
    sourceDocId: uuid("source_doc_id").references(() => sourceDoc.id),
    estadoProva: text("estado_prova").notNull().default("direto"), // direto|a_confirmar|superseded
    // §11 credencial (binária, por documento)
    tipoCriterio: text("tipo_criterio").notNull().default("competencia"), // competencia|credencial
    credencialEstado: text("credencial_estado"), // por_verificar|verificado|invalido|expirado
    credencialDocRef: text("credencial_doc_ref"),
    // §12 frescura (re-entrevista)
    revalidateAfter: timestamp("revalidate_after", { withTimezone: true }),
    // §13 afirmou alto e não sustentou (≠ raso honesto)
    naoSustentado: boolean("nao_sustentado").notNull().default(false),
    // §16A proveniência dura chunk→facto
    sourceChunkId: uuid("source_chunk_id").array(), // FK lógica → transcript_chunk
    sourceDocumentId: uuid("source_document_id").references(() => document.id),
    cvVersion: integer("cv_version"),
    // §16F requisito com ID canónico (estável através de rubric.version)
    requisitoId: uuid("requisito_id"),
    // §16L veredito graduado DURÁVEL + decomposição
    rubricLevel: text("rubric_level"), // fraco|ok|forte
    confianca: text("confianca").default("media"), // alta|media|baixa
    confiancaMotivo: text("confianca_motivo"),
    parentFactId: uuid("parent_fact_id").references((): AnyPgColumn => candidateMemoryFact.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("cmf_candidate_competencia_idx").on(t.candidateId, t.competencia),
    check(
      "cmf_rubric_level_chk",
      sql`${t.rubricLevel} IS NULL OR ${t.rubricLevel} IN ('fraco','ok','forte')`,
    ),
    check(
      "cmf_confianca_chk",
      sql`${t.confianca} IS NULL OR ${t.confianca} IN ('alta','media','baixa')`,
    ),
  ],
);

/** Embedding do facto do candidato (pgvector). */
export const candidateMemoryEmbedding = pgTable(
  "candidate_memory_embedding",
  {
    id: pk(),
    factId: uuid("fact_id")
      .notNull()
      .references(() => candidateMemoryFact.id, { onDelete: "cascade" }),
    agencyId: agencyId(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }).notNull(),
  },
  (t) => [index("cme_embedding_idx").using("ivfflat", t.embedding.op("vector_cosine_ops"))],
);
