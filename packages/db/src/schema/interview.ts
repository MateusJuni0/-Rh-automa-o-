import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { agencyId, createdAt, pk } from "./_shared";
import { recruiter } from "./agency";
import { candidate } from "./candidate";
import { process } from "./process";

/** Entrevista. process_id NULLABLE (órfã/cold-start §12). distilled_at = gate da purga de áudio (§16H). */
export const interview = pgTable(
  "interview",
  {
    id: pk(),
    agencyId: agencyId(),
    processId: uuid("process_id").references(() => process.id), // NULL = órfã (status 'unstructured')
    // §16H/RGPD: atribui a entrevista (incl. órfã, process_id NULL) ao candidato → purgável.
    candidateId: uuid("candidate_id").references(() => candidate.id),
    recruiterId: uuid("recruiter_id")
      .notNull()
      .references(() => recruiter.id),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: text("status").notNull().default("scheduled"), // scheduled|live|done|unstructured
    captureType: text("capture_type"), // bot_online|local_mic|none
    livekitRoom: text("livekit_room"),
    distilledAt: timestamp("distilled_at", { withTimezone: true }), // §16H set por distill_final=done
  },
  (t) => [
    index("interview_agency_status_idx").on(t.agencyId, t.status),
    index("interview_agency_recruiter_idx").on(t.agencyId, t.recruiterId),
    index("interview_candidate_idx").on(t.candidateId),
    check("interview_status_chk", sql`${t.status} IN ('scheduled','live','done','unstructured')`),
    check(
      "interview_capture_type_chk",
      sql`${t.captureType} IS NULL OR ${t.captureType} IN ('bot_online','local_mic','none')`,
    ),
  ],
);

/** Tick do estado vivo (Camada B). Custo/tokens/modelo/latência = §14 (dashboard + teto). */
export const interviewTick = pgTable(
  "interview_tick",
  {
    id: pk(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interview.id),
    agencyId: agencyId(), // §15.1 + guia consolidação item 9 ("agency_id em TODAS as tabelas")
    tickN: integer("tick_n").notNull(),
    liveState: jsonb("live_state").notNull(),
    suggestion: jsonb("suggestion"), // {texto, lente, requisito_id}
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 5 }),
    modelUsed: text("model_used"),
    tickLatencyMs: integer("tick_latency_ms"),
    degraded: boolean("degraded").notNull().default(false),
    derivedFromChunkIds: jsonb("derived_from_chunk_ids"), // §16A re-atribuição/auditoria
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("interview_tick_interview_tickn_uidx").on(t.interviewId, t.tickN)],
);

/** Intervalo SEM captura — torna o buraco PROVÁVEL no parecer (§14, BLOQUEADOR). */
export const interviewGap = pgTable(
  "interview_gap",
  {
    id: pk(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interview.id),
    agencyId: agencyId(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms"), // NULL = gap a decorrer
    cause: text("cause").notNull(), // stt_reconnect|network|app_crash|pc_sleep|manual_pause|cost_cap
    sourceStreamIdBefore: text("source_stream_id_before"),
    sourceStreamIdAfter: text("source_stream_id_after"),
    createdAt: createdAt(),
  },
  (t) => [index("interview_gap_interview_idx").on(t.interviewId)],
);

/** Participante da entrevista — track→role (§16M). Role-binding ≠ diarização. */
export const interviewParticipant = pgTable(
  "interview_participant",
  {
    id: pk(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interview.id),
    agencyId: agencyId(),
    trackId: text("track_id"), // faixa LiveKit / cluster de voz
    speakerRole: text("speaker_role").notNull().default("unknown"), // candidate|client|recruiter|other|unknown
    displayName: text("display_name"),
    boundBy: uuid("bound_by").references(() => recruiter.id), // quem CONFIRMOU o role (a Filipa)
    boundAt: timestamp("bound_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("interview_participant_interview_idx").on(t.interviewId)],
);
