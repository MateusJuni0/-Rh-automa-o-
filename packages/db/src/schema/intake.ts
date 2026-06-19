import { sql } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agencyId, createdAt, pk } from "./_shared";
import { recruiter } from "./agency";
import { client } from "./client";
import { job } from "./job";

/** Sessão de ingestão multi-mensagem (Telegram Fluxo C). Persistida ao fechar; Redis = contexto vivo. */
export const intakeSession = pgTable(
  "intake_session",
  {
    id: pk(),
    agencyId: agencyId(),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => recruiter.id),
    telegramChatId: bigint("telegram_chat_id", { mode: "number" }).notNull(),
    status: text("status").notNull().default("open"), // open|confirmed|cancelled|expired
    targetEntity: text("target_entity"), // new_job|existing_job|candidate_cv
    targetJobId: uuid("target_job_id").references(() => job.id),
    targetClientId: uuid("target_client_id").references(() => client.id),
    messagesRaw: jsonb("messages_raw").notNull().default([]),
    extraction: jsonb("extraction"),
    createdAt: createdAt(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).default(
      sql`now() + interval '2 hours'`,
    ),
  },
  (t) => [
    index("intake_session_open_idx")
      .on(t.telegramChatId, t.status)
      .where(sql`${t.status} = 'open'`),
  ],
);

/** Mensagens encaminhadas (Telegram/web/email). Intake tipado: alvo/intenção (§5). */
export const intakeMessage = pgTable(
  "intake_message",
  {
    id: pk(),
    agencyId: agencyId(),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => recruiter.id),
    source: text("source").notNull(), // telegram|web_upload|email
    telegramChatId: bigint("telegram_chat_id", { mode: "number" }),
    telegramMsgId: bigint("telegram_msg_id", { mode: "number" }),
    sessionId: uuid("session_id").references(() => intakeSession.id),
    rawText: text("raw_text"),
    docPath: text("doc_path"),
    audioPath: text("audio_path"),
    audioTranscript: text("audio_transcript"),
    extracted: jsonb("extracted"),
    entityType: text("entity_type"), // job_requirements|candidate_cv|client_feedback|unknown
    entityId: uuid("entity_id"),
    // §5 intake tipado (alvo + intenção)
    alvo: text("alvo"), // cliente|vaga|candidato
    alvoId: uuid("alvo_id"),
    intencao: text("intencao"), // setup|add_requisito|corrigir_facto|pergunta|nova_vaga
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("intake_message_unconfirmed_idx")
      .on(t.agencyId, t.confirmedAt)
      .where(sql`${t.confirmedAt} IS NULL`),
  ],
);
