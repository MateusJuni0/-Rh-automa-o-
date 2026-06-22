import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, eq, inArray, isNotNull, like, lt, or } from "drizzle-orm";

type Db = DbHandle["db"];

/**
 * Crons de retenção por TTL (DATA-RETENTION §1/§3): purgam/redigem dados efémeros passado o prazo.
 * v1 = funções DETERMINÍSTICAS, testáveis, agency-scoped (a regra de ferro: `agency_id` sempre). O
 * *agendamento* (timers diários) + o monitor "correu nas últimas 24h" + a cascata Storage/RAG ficam
 * para a FASE Ω. `purge_candidate` (Art.17, evento) é a `purgeCandidate` do rgpd.ts — não é cron.
 *
 * `now` é injetado (não `new Date()` interno) → os testes controlam o relógio.
 */

/** Defaults de fábrica (DATA-RETENTION §2; editáveis pela agência na Fase Ω). */
export const RETENTION_DAYS = {
  /** `intake_message` cru: apaga raw/ficheiros N dias após confirmado (mantém entity_id/extracted). */
  intakeRaw: 30,
  /** `async_job` done/failed: sem valor durável, apaga N dias depois. */
  asyncJob: 30,
} as const;

/** `now` menos N dias. Aritmética de ms (pressupõe o servidor em UTC; o ±1h de DST é inócuo p/
 * TTLs de 30 dias — as colunas são `timestamptz`). */
function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

export interface RetentionResult {
  personalFacts: number;
  sourceDocs: number;
  intakeMessages: number;
  asyncJobs: number;
}

/**
 * §1.4 — factos `personal*` (fora do score) passado o `retain_until`: apaga (o embedding cai por
 * cascata FK). Os `professional*` (valor/calibração) NUNCA saem por tempo — só na purga do candidato.
 */
export async function purgeExpiredPersonalFacts(
  db: Db,
  agencyId: string,
  now: Date,
): Promise<number> {
  const rows = await db
    .delete(schema.candidateMemoryFact)
    .where(
      and(
        eq(schema.candidateMemoryFact.agencyId, agencyId),
        like(schema.candidateMemoryFact.classificacao, "personal%"),
        isNotNull(schema.candidateMemoryFact.retainUntil),
        lt(schema.candidateMemoryFact.retainUntil, now),
      ),
    )
    .returning({ id: schema.candidateMemoryFact.id });
  return rows.length;
}

/**
 * §1.3 — `source_doc.raw_text` cru passado o `expires_at`: apaga só o cru, mantém title/url/summary
 * (proveniência que sustenta o parecer). Redação in-place (a linha fica).
 */
export async function redactExpiredSourceDocs(
  db: Db,
  agencyId: string,
  now: Date,
): Promise<number> {
  const rows = await db
    .update(schema.sourceDoc)
    .set({ rawText: null })
    .where(
      and(
        eq(schema.sourceDoc.agencyId, agencyId),
        isNotNull(schema.sourceDoc.expiresAt),
        lt(schema.sourceDoc.expiresAt, now),
        isNotNull(schema.sourceDoc.rawText),
      ),
    )
    .returning({ id: schema.sourceDoc.id });
  return rows.length;
}

/**
 * §1.8 — `intake_message` cru (raw_text/doc/áudio) N dias após `confirmed_at`: redige o cru, mantém
 * `entity_id`/`extracted` (o sinal leve já ligado à entidade). Não toca em mensagens por confirmar.
 */
export async function redactExpiredIntakeRaw(
  db: Db,
  agencyId: string,
  now: Date,
  days: number = RETENTION_DAYS.intakeRaw,
): Promise<number> {
  const cutoff = daysBefore(now, days);
  const rows = await db
    .update(schema.intakeMessage)
    .set({ rawText: null, docPath: null, audioPath: null, audioTranscript: null })
    .where(
      and(
        eq(schema.intakeMessage.agencyId, agencyId),
        isNotNull(schema.intakeMessage.confirmedAt),
        lt(schema.intakeMessage.confirmedAt, cutoff),
        or(
          isNotNull(schema.intakeMessage.rawText),
          isNotNull(schema.intakeMessage.docPath),
          isNotNull(schema.intakeMessage.audioPath),
          isNotNull(schema.intakeMessage.audioTranscript),
        ),
      ),
    )
    .returning({ id: schema.intakeMessage.id });
  return rows.length;
}

/** §1.8 — `async_job` concluído (done/failed) há mais de N dias: sem valor durável, apaga a linha. */
export async function purgeOldAsyncJobs(
  db: Db,
  agencyId: string,
  now: Date,
  days: number = RETENTION_DAYS.asyncJob,
): Promise<number> {
  const cutoff = daysBefore(now, days);
  const rows = await db
    .delete(schema.asyncJob)
    .where(
      and(
        eq(schema.asyncJob.agencyId, agencyId),
        inArray(schema.asyncJob.status, ["done", "failed"]),
        lt(schema.asyncJob.updatedAt, cutoff),
      ),
    )
    .returning({ id: schema.asyncJob.id });
  return rows.length;
}

/**
 * Orquestrador (o "tick" do cron diário, FASE Ω agenda-o). Corre todas as purgas por TTL de uma
 * agência e devolve as contagens. Sem falha silenciosa: o caller (Ω) regista `last_run_ok`/alerta.
 */
export async function runRetention(
  db: Db,
  agencyId: string,
  opts: { now?: Date } = {},
): Promise<RetentionResult> {
  // Sem falha silenciosa (DATA-RETENTION §4): um agencyId vazio (env mal-carregado) purgaria nada
  // e ninguém notaria — o trauma do claude-mem que parou em silêncio. Falha alto, à cabeça.
  if (!agencyId) {
    throw new Error("runRetention: agencyId é obrigatório");
  }
  const now = opts.now ?? new Date();
  const [personalFacts, sourceDocs, intakeMessages, asyncJobs] = await Promise.all([
    purgeExpiredPersonalFacts(db, agencyId, now),
    redactExpiredSourceDocs(db, agencyId, now),
    redactExpiredIntakeRaw(db, agencyId, now),
    purgeOldAsyncJobs(db, agencyId, now),
  ]);
  return { personalFacts, sourceDocs, intakeMessages, asyncJobs };
}
