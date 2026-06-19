import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { agencyId, createdAt, deletedAt, pk, updatedAt } from "./_shared";
import { recruiter } from "./agency";
import { candidate } from "./candidate";
import { job } from "./job";
import { report } from "./report";

/** Processo = candidatura (candidate × job). Chave canónica do ciclo (§1 guia consolidação). */
export const process = pgTable(
  "process",
  {
    id: pk(),
    agencyId: agencyId(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidate.id),
    jobId: uuid("job_id")
      .notNull()
      .references(() => job.id),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => recruiter.id),
    stage: text("stage").notNull().default("sourced"),
    statusReason: text("status_reason"),
    // Consentimento (§7 guia consolidação)
    consentStatus: text("consent_status"),
    consentEvidenceRef: text("consent_evidence_ref"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    createdAt: createdAt(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex("process_candidate_job_uidx").on(t.candidateId, t.jobId),
    index("process_job_stage_idx").on(t.jobId, t.stage),
    index("process_candidate_idx").on(t.candidateId),
  ],
);

/** Veredito do cliente (calibração). Canónico: process_id NOT NULL, SEM job_id/candidate_id (§1). */
export const clientVerdict = pgTable(
  "client_verdict",
  {
    id: pk(),
    agencyId: agencyId(),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id),
    reportId: uuid("report_id").references(() => report.id),
    verdict: text("verdict").notNull(), // approved|rejected|pending
    reason: text("reason"),
    reasonType: text("reason_type"), // skill_gap|cultural_fit|salary|misrepresentation|other (§13)
    botPredicted: text("bot_predicted"), // strong|ok|weak
    botFlagInconsistencia: boolean("bot_flag_inconsistencia"), // §13 ALTO5
    rubricVersion: integer("rubric_version"), // §16E calibração por versão de régua
    createdAt: createdAt(),
  },
  (t) => [
    // Calibração "todos os vereditos de um job/process" — porta do índice da spec
    // (era (job_id, verdict); job_id → process_id na evolução G1/G2). FKs não criam índice implícito.
    index("client_verdict_process_idx").on(t.processId, t.verdict),
  ],
);

/** Resultado da colocação — ground-truth da calibração. */
export const placementOutcome = pgTable("placement_outcome", {
  id: pk(),
  agencyId: agencyId(),
  processId: uuid("process_id")
    .notNull()
    .references(() => process.id)
    .unique(),
  decision: text("decision").notNull(), // hired|offer_declined|rejected
  declineReason: text("decline_reason"),
  guaranteeResult: text("guarantee_result"), // stayed|left_in_guarantee|pending
  guaranteeUntil: timestamp("guarantee_until", { withTimezone: true }),
  botPredicted: text("bot_predicted"),
  rubricVersion: integer("rubric_version"), // §16E
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
