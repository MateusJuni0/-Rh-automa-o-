import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agencyId, createdAt, pk } from "./_shared";
import { recruiter } from "./agency";
import { process } from "./process";

/** Agenda do assistente proativo (reuniões — Google Calendar). ≠ proactive_task. */
export const agendaEvent = pgTable("agenda_event", {
  id: pk(),
  agencyId: agencyId(),
  recruiterId: uuid("recruiter_id")
    .notNull()
    .references(() => recruiter.id),
  processId: uuid("process_id").references(() => process.id),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  source: text("source").notNull().default("google_calendar"), // google_calendar|manual
  externalRef: text("external_ref"),
  prepSentAt: timestamp("prep_sent_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Tarefa agendada (follow-up de garantia, sugestão, prep…) — §16D. target_id é polimórfico. */
export const proactiveTask = pgTable(
  "proactive_task",
  {
    id: pk(),
    agencyId: agencyId(),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => recruiter.id),
    kind: text("kind").notNull(), // guarantee_followup|comparison_suggest|prep_summary|noshow_reschedule
    targetType: text("target_type").notNull(), // candidate|process|interview|client
    targetId: uuid("target_id").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"), // pending|fired|cancelled|suppressed
    payload: jsonb("payload").notNull().default({}),
    firedAt: timestamp("fired_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("proactive_task_status_due_idx").on(t.status, t.dueAt)],
);
