import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agencyId, createdAt, deletedAt, pk } from "./_shared";
import { sourceDoc } from "./knowledge";

/** Cliente (empresa que contrata). */
export const client = pgTable("client", {
  id: pk(),
  agencyId: agencyId(),
  name: text("name").notNull(),
  notes: text("notes"),
  aliases: text("aliases").array(), // alcunhas ("TechCorp", "a Tech") — MODELO §12
  // Perfil do cliente (ficha). Hoje preenchido manualmente/demo; FUTURO: enriquecido do site (logoUrl).
  website: text("website"),
  sector: text("sector"),
  description: text("description"),
  logoUrl: text("logo_url"),
  // Detalhe da empresa (ficha rica) — preenchido do site/LinkedIn ou pela Filipa.
  location: text("location"), // sede / mercado (ex.: "Lisboa, Portugal")
  founded: text("founded"), // ano de fundação (ex.: "2011")
  headcount: text("headcount"), // dimensão da equipa (ex.: "600+")
  linkedinUrl: text("linkedin_url"),
  techStack: text("tech_stack").array(), // stack principal (chips)
  purgeAfter: timestamp("purge_after", { withTimezone: true }), // RGPD apagamento recuperável (§6)
  createdAt: createdAt(),
  deletedAt: deletedAt(),
});

/** Factos do cliente (RAG — o que valoriza). Proveniência obrigatória. */
export const clientMemoryFact = pgTable("client_memory_fact", {
  id: pk(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id),
  agencyId: agencyId(),
  factText: text("fact_text").notNull(),
  factType: text("fact_type").notNull(), // preference|rejection_reason|context
  sourceType: text("source_type").notNull(), // intake_doc|client_verdict|manual|live_reveal (§13)
  sourceRef: text("source_ref"),
  sourceSnippet: text("source_snippet"),
  sourceDocId: uuid("source_doc_id").references(() => sourceDoc.id), // §7 proveniência web
  corrigidoPelaFilipa: boolean("corrigido_pela_filipa").notNull().default(false), // §5 correção humana
  createdAt: createdAt(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }), // NULL = aguarda confirmação
  deletedAt: deletedAt(),
});

/** Critérios que ESTE cliente sempre pede — viram linhas de rubric + secções do relatório (§3 Evolução). */
export const clientCriteria = pgTable(
  "client_criteria",
  {
    id: pk(),
    agencyId: agencyId(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id),
    jobId: uuid("job_id"), // NULL = vale p/ todas as vagas. FK lógica → job (evita ciclo de import).
    criterio: text("criterio").notNull(),
    peso: text("peso").notNull().default("normal"), // must|normal|nice
    origem: text("origem").notNull().default("setup"), // setup|verdict_inferido|manual
    sourceRef: text("source_ref"),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("client_criteria_client_idx").on(t.clientId)],
);
