import { index, numeric, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import { agencyId, createdAt, EMBEDDING_DIM, pk } from "./_shared";
import { candidate } from "./candidate";
import { client } from "./client";
import { job } from "./job";

/** Conteúdo cru pesquisado (web/repo/site/doc) — Role Profile (Antes) E pesquisa ao vivo (§7/§16K). */
export const sourceDoc = pgTable(
  "source_doc",
  {
    id: pk(),
    agencyId: agencyId(),
    kind: text("kind").notNull(), // web|repo|site|doc
    url: text("url"),
    title: text("title"),
    rawText: text("raw_text"),
    summary: text("summary"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    // a que entidade se refere (uma só, conforme o uso)
    jobId: uuid("job_id").references(() => job.id),
    candidateId: uuid("candidate_id").references(() => candidate.id),
    clientId: uuid("client_id").references(() => client.id),
    confianca: text("confianca").notNull().default("media"), // alta|media|baixa
    // §16K pesquisa ao vivo robusta
    fetchStatus: text("fetch_status").notNull().default("ok"), // ok|not_found|forbidden|timeout|blocked_ssrf|unrenderable|cap_reached
    fetchedError: text("fetched_error"),
    fetchCostUsd: numeric("fetch_cost_usd", { precision: 10, scale: 5 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("source_doc_candidate_idx").on(t.candidateId),
    index("source_doc_job_idx").on(t.jobId),
  ],
);

/** Embedding do source_doc (pgvector). */
export const sourceDocEmbedding = pgTable(
  "source_doc_embedding",
  {
    id: pk(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourceDoc.id, { onDelete: "cascade" }),
    agencyId: agencyId(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }).notNull(),
  },
  (t) => [index("sde_embedding_idx").using("ivfflat", t.embedding.op("vector_cosine_ops"))],
);
