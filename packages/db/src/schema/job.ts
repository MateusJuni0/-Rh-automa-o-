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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { agencyId, createdAt, deletedAt, pk } from "./_shared";
import { recruiter } from "./agency";
import { candidate } from "./candidate";
import { client } from "./client";

/** Vaga / mandato. */
export const job = pgTable("job", {
  id: pk(),
  agencyId: agencyId(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id),
  recruiterId: uuid("recruiter_id")
    .notNull()
    .references(() => recruiter.id),
  title: text("title").notNull(),
  roleTypeSlug: text("role_type_slug").notNull(),
  requirements: jsonb("requirements").notNull().default({}),
  // Ficha completa da vaga (recrutador): condições, processo, responsabilidades — tudo o que a
  // Filipa precisa para responder ao candidato. Preenchida pela Vera (do pedido do cliente) e editável.
  details: jsonb("details").notNull().default({}),
  status: text("status").notNull().default("active"), // active|closed|paused
  nVagas: integer("n_vagas").notNull().default(1), // §11 contratação em volume
  createdAt: createdAt(),
  deletedAt: deletedAt(),
});

/** Role Profile — conhecimento de mercado por role-type (cache 90d). */
export const roleProfile = pgTable(
  "role_profile",
  {
    id: pk(),
    agencyId: agencyId(),
    roleTypeSlug: text("role_type_slug").notNull(),
    competencias: jsonb("competencias").notNull().default([]),
    oQueEBom: jsonb("o_que_e_bom").notNull().default({}),
    sinaisNivelErrado: jsonb("sinais_nivel_errado").notNull().default([]),
    linguagemFilipa: jsonb("linguagem_filipa").notNull().default({}),
    perguntasChave: jsonb("perguntas_chave").notNull().default([]),
    sources: jsonb("sources").notNull().default([]),
    // §11 porta de confirmação + confiança da fonte (web pode trazer lixo)
    confirmedBy: uuid("confirmed_by").references(() => recruiter.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    sourceConfidence: text("source_confidence").notNull().default("media"), // alta|media|baixa
    nSources: integer("n_sources").notNull().default(0),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).default(
      sql`now() + interval '90 days'`,
    ),
  },
  (t) => [uniqueIndex("role_profile_agency_slug_uidx").on(t.agencyId, t.roleTypeSlug)],
);

/** Rubric — gabarito (fraco/ok/forte) por requisito. 1 por vaga (versão in-place via `version`). */
export const rubric = pgTable("rubric", {
  id: pk(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => job.id)
    .unique(),
  agencyId: agencyId(),
  // criteria[]: { requisito_id(UUID estável §16F), requisito, pergunta_sonda, fraco/ok/forte,
  //   linguagem_filipa, peso(must|normal|nice), origem, origin_criteria_id, tipo(competencia|credencial) }
  criteria: jsonb("criteria").notNull().default([]),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  modelUsed: text("model_used").notNull().default("claude-opus-4-8"),
  version: integer("version").notNull().default(1), // §8 H4 versionamento mid-process
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
});

/** Documentos — do cliente (requisitos) E do candidato global (vários CVs, CVs gerados, relatórios — §9/§16C). */
export const document = pgTable(
  "document",
  {
    id: pk(),
    agencyId: agencyId(),
    jobId: uuid("job_id").references(() => job.id),
    clientId: uuid("client_id").references(() => client.id),
    candidateId: uuid("candidate_id").references(() => candidate.id), // §9 CV pertence ao candidato global
    filename: text("filename").notNull(),
    storagePath: text("storage_path").notNull(),
    docType: text("doc_type").notNull(), // job_requirements|candidate_cv|other
    extracted: jsonb("extracted"),
    version: integer("version").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    source: text("source").notNull().default("uploaded"), // uploaded|generated|report|attested
    generatedFor: text("generated_for"),
    basedOnDocumentId: uuid("based_on_document_id").references((): AnyPgColumn => document.id), // §16C
    createdAt: createdAt(),
  },
  (t) => [
    index("document_candidate_idx").on(t.candidateId, t.docType, t.version),
    // §16C: CV gerado pela Vera NUNCA é o corrente (não alimenta perfil/juízo).
    check(
      "doc_is_current_only_uploaded",
      sql`${t.isCurrent} = false OR ${t.source} IN ('uploaded','attested')`,
    ),
  ],
);
