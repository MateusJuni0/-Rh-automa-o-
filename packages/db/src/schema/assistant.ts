import { boolean, index, jsonb, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import { agencyId, createdAt, deletedAt, EMBEDDING_DIM, pk, updatedAt } from "./_shared";
import { recruiter } from "./agency";

/** Conversa do agente — durável (§12), sobrevive a fechar a app. Redis = só cache quente. */
export const assistantThread = pgTable("assistant_thread", {
  id: pk(),
  agencyId: agencyId(),
  recruiterId: uuid("recruiter_id")
    .notNull()
    .references(() => recruiter.id),
  activeContext: jsonb("active_context").notNull().default({}), // {client_id?, job_id?, candidate_id?, process_id?}
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assistantMessage = pgTable("assistant_message", {
  id: pk(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => assistantThread.id),
  agencyId: agencyId(), // §15.1 + guia consolidação item 9 ("agency_id em TODAS as tabelas")
  role: text("role").notNull(), // recruiter|assistant
  content: text("content").notNull(),
  refs: jsonb("refs"), // entidades/fontes citadas
  createdAt: createdAt(),
});

/** Trilho de auditoria das ações (tool-calls). enviar_fora exige confirmed_by. Idempotência §16I. */
export const assistantAction = pgTable(
  "assistant_action",
  {
    id: pk(),
    agencyId: agencyId(),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => recruiter.id),
    threadId: uuid("thread_id").references(() => assistantThread.id), // §12 fila de confirmações
    tool: text("tool").notNull(),
    efeito: text("efeito").notNull().default("leitura"), // leitura|gravar|enviar_fora
    args: jsonb("args").notNull().default({}),
    resultRef: text("result_ref"),
    needsConfirm: boolean("needs_confirm").notNull().default(false),
    confirmedBy: uuid("confirmed_by").references(() => recruiter.id),
    status: text("status").notNull().default("done"), // pending_confirm|done|rejected|failed
    // §16I idempotência das ações enviar_fora (anti duplo-envio em retry)
    idempotencyKey: text("idempotency_key"),
    providerMessageId: text("provider_message_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // confirmação pendente expira
    createdAt: createdAt(),
  },
  (t) => [index("assistant_action_recruiter_idx").on(t.recruiterId, t.createdAt)],
);

/** Tarefas longas (sourcing, gen_parecer, distill_final…) — duráveis e retomáveis (§12). */
export const asyncJob = pgTable("async_job", {
  id: pk(),
  agencyId: agencyId(),
  recruiterId: uuid("recruiter_id")
    .notNull()
    .references(() => recruiter.id),
  threadId: uuid("thread_id").references(() => assistantThread.id),
  kind: text("kind").notNull(), // sourcing|gen_doc|export|gen_parecer|distill_final|...
  args: jsonb("args").notNull().default({}),
  status: text("status").notNull().default("running"), // running|done|failed|pending_confirm
  progress: jsonb("progress"), // {pct, msg}
  resultRef: text("result_ref"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Memória do RECRUTADOR (estilo/preferências/padrões da Filipa) — personalização (§8). */
export const recruiterMemoryFact = pgTable(
  "recruiter_memory_fact",
  {
    id: pk(),
    agencyId: agencyId(),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => recruiter.id),
    kind: text("kind").notNull(), // style|preference|pattern|template
    factText: text("fact_text").notNull(),
    sourceType: text("source_type").notNull().default("learned"), // learned|explicit
    sourceRef: text("source_ref"),
    confidence: text("confidence").notNull().default("media"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("rmf_recruiter_kind_idx").on(t.recruiterId, t.kind)],
);

/** Embedding da memória do recrutador (pgvector). */
export const recruiterMemoryEmbedding = pgTable(
  "recruiter_memory_embedding",
  {
    id: pk(),
    factId: uuid("fact_id")
      .notNull()
      .references(() => recruiterMemoryFact.id, { onDelete: "cascade" }),
    agencyId: agencyId(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }).notNull(),
  },
  (t) => [index("rme_embedding_idx").using("ivfflat", t.embedding.op("vector_cosine_ops"))],
);
