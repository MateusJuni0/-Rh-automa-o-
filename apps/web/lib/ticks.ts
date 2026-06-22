import { randomUUID } from "node:crypto";
import type { TickOutput } from "@rh/ai";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, asc, eq, sql } from "drizzle-orm";

type Db = DbHandle["db"];

/** Metadados de custo/modelo do tick (§14). No mock ficam nulos; a chave preenche-os. */
export interface TickMeta {
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  modelUsed?: string;
  tickLatencyMs?: number;
  degraded?: boolean;
}

/** Próximo `tick_n` da entrevista (0 se nenhum). Leitura do escritor único. */
export async function nextTickN(db: Db, interviewId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${schema.interviewTick.tickN})` })
    .from(schema.interviewTick)
    .where(eq(schema.interviewTick.interviewId, interviewId));
  return (row?.max ?? -1) + 1;
}

/**
 * Escritor ÚNICO do estado vivo (ARQUITETURA-TEMPO-REAL §11) com **CAS por `tick_n`**: não duplica
 * o mesmo `tick_n` (idempotente). O `tick_n` é monótono — vem do contador do escritor (família G).
 * NOTA: a unicidade forte `UNIQUE(interview_id, tick_n)` fica para o lote de endurecimento DB (FASE N);
 * o escritor único + esta verificação cobrem o risco real no v1.
 */
export type PersistTickResult = {
  persisted: boolean;
  tickN: number;
  reason?: "not_found" | "interview_closed" | "duplicate";
};

export async function persistTick(
  db: Db,
  agencyId: string,
  interviewId: string,
  tickN: number,
  out: TickOutput,
  meta: TickMeta = {},
): Promise<PersistTickResult> {
  // Família G (§11.1/1+3): a escrita serializa-se numa transação que TRANCA a linha da entrevista
  // (FOR UPDATE) → o CAS de encerramento concorrente espera, e se já encerrou esta vê 'done' e
  // recusa-se (fecha a janela check-then-insert). Permitido enquanto NÃO encerrada (live/scheduled/
  // unstructured — a entrevista órfã também grava); só 'done' é recusado.
  return db.transaction(async (tx) => {
    const [iv] = await tx
      .select({ status: schema.interview.status })
      .from(schema.interview)
      .where(and(eq(schema.interview.id, interviewId), eq(schema.interview.agencyId, agencyId)))
      .for("update");
    if (!iv) {
      return { persisted: false, tickN, reason: "not_found" };
    }
    if (iv.status === "done") {
      return { persisted: false, tickN, reason: "interview_closed" };
    }
    const existing = await tx
      .select({ id: schema.interviewTick.id })
      .from(schema.interviewTick)
      .where(
        and(
          eq(schema.interviewTick.interviewId, interviewId),
          eq(schema.interviewTick.tickN, tickN),
        ),
      );
    if (existing.length > 0) {
      return { persisted: false, tickN, reason: "duplicate" };
    }
    await tx.insert(schema.interviewTick).values({
      id: randomUUID(),
      interviewId,
      agencyId,
      tickN,
      liveState: out.estado,
      suggestion: out.suggestion ?? null,
      tokensIn: meta.tokensIn ?? null,
      tokensOut: meta.tokensOut ?? null,
      costUsd: meta.costUsd != null ? String(meta.costUsd) : null,
      modelUsed: meta.modelUsed ?? null,
      tickLatencyMs: meta.tickLatencyMs ?? null,
      degraded: meta.degraded ?? false,
    });
    return { persisted: true, tickN };
  });
}

export interface PersistedTick {
  tickN: number;
  liveState: unknown;
  suggestion: unknown;
  degraded: boolean;
}

/** Lê os ticks da entrevista por ordem de `tick_n` (base do replay na reconexão). */
export async function readTicks(
  db: Db,
  agencyId: string,
  interviewId: string,
): Promise<PersistedTick[]> {
  return db
    .select({
      tickN: schema.interviewTick.tickN,
      liveState: schema.interviewTick.liveState,
      suggestion: schema.interviewTick.suggestion,
      degraded: schema.interviewTick.degraded,
    })
    .from(schema.interviewTick)
    .where(
      and(
        eq(schema.interviewTick.interviewId, interviewId),
        eq(schema.interviewTick.agencyId, agencyId),
      ),
    )
    .orderBy(asc(schema.interviewTick.tickN));
}

/**
 * Bridge TickEngine → escritor único: devolve um `onTick` compatível com `TickEngine` que persiste
 * cada tick com `tick_n` monótono. Uso: `new TickEngine({ onTick: createTickPersister(db, ag, id), … })`.
 */
export function createTickPersister(
  db: Db,
  agencyId: string,
  interviewId: string,
): (out: TickOutput) => Promise<void> {
  let n = 0;
  return async (out: TickOutput): Promise<void> => {
    const result = await persistTick(db, agencyId, interviewId, n, out);
    // Só avança o contador quando o tick É escrito — um tick recusado (duplicate/closed/not_found)
    // não pode abrir um buraco na sequência monótona que o replay da reconexão assume.
    if (result.persisted) {
      n += 1;
    }
  };
}
