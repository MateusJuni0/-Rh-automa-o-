import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agencyId, pk } from "./_shared";
import { interview } from "./interview";

/**
 * Parecer. Ciclo de vida durável (§16B): nasce 'generating' (gen_parecer job) → 'ready'.
 * content_md é NULLABLE — o registo existe enquanto gera (reconciliação base-DDL NOT NULL × §16B
 * lifecycle; o §16B é mais recente e específico → ganha). Duas versões: interna + cliente (§5).
 */
export const report = pgTable(
  "report",
  {
    id: pk(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interview.id)
      .unique(),
    agencyId: agencyId(),
    contentMd: text("content_md"), // versão interna (leitura rápida da Filipa)
    contentEdited: text("content_edited"), // edição da Filipa
    contentClientMd: text("content_client_md"), // §5 versão polida para o cliente
    clientSentAt: timestamp("client_sent_at", { withTimezone: true }),
    modelUsed: text("model_used").notNull().default("claude-opus-4-8"),
    rubricVersion: integer("rubric_version"), // §8 contra que versão avaliou
    // §6 override da Filipa ao veredito do bot (alimenta calibração)
    filipaVerdictOverride: text("filipa_verdict_override"), // strong|ok|weak
    filipaOverrideReason: text("filipa_override_reason"),
    botVerdict: text("bot_verdict"),
    // §16B ciclo de vida
    status: text("status").notNull().default("generating"), // generating|ready|failed
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }), // stale (correção a montante)
    staleReason: text("stale_reason"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
    exportedAt: timestamp("exported_at", { withTimezone: true }),
  },
  (t) => [check("report_status_chk", sql`${t.status} IN ('generating','ready','failed')`)],
);
