import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

type Db = DbHandle["db"];

/** Constantes de resiliência (RESILIENCIA-E-FALHAS §1/§4). */
export const TICK_DEGRADE_MS = 60_000;
export const RECONNECT_AUDIO_MS = 3_000;

export type GapCause =
  | "stt_reconnect"
  | "network"
  | "app_crash"
  | "pc_sleep"
  | "manual_pause"
  | "cost_cap";

export interface OpenGapParams {
  startMs: number;
  cause: GapCause;
  sourceStreamIdBefore?: string;
}

/**
 * Abre um `interview_gap` (captura perdida) — torna o buraco PROVÁVEL no parecer (§14: vira
 * "⬜ não-capturado", distinto de silêncio). `end_ms` null = a decorrer. A entrevista NÃO encerra.
 */
export async function openGap(
  db: Db,
  agencyId: string,
  interviewId: string,
  p: OpenGapParams,
): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.interviewGap).values({
    id,
    interviewId,
    agencyId,
    startMs: p.startMs,
    endMs: null,
    cause: p.cause,
    sourceStreamIdBefore: p.sourceStreamIdBefore ?? null,
  });
  return id;
}

/** Fecha um gap (captura voltou). CAS: só fecha se ainda aberto (`end_ms` null) → idempotente. */
export async function closeGap(
  db: Db,
  agencyId: string,
  gapId: string,
  p: { endMs: number; sourceStreamIdAfter?: string },
): Promise<boolean> {
  const updated = await db
    .update(schema.interviewGap)
    .set({ endMs: p.endMs, sourceStreamIdAfter: p.sourceStreamIdAfter ?? null })
    .where(
      and(
        eq(schema.interviewGap.id, gapId),
        eq(schema.interviewGap.agencyId, agencyId),
        isNull(schema.interviewGap.endMs),
      ),
    )
    .returning({ id: schema.interviewGap.id });
  return updated.length > 0;
}

export interface GapView {
  startMs: number;
  endMs: number | null;
  cause: string;
}

/** Lê os gaps da entrevista (para a secção "não-capturado" do parecer §14). */
export async function readGaps(db: Db, agencyId: string, interviewId: string): Promise<GapView[]> {
  return db
    .select({
      startMs: schema.interviewGap.startMs,
      endMs: schema.interviewGap.endMs,
      cause: schema.interviewGap.cause,
    })
    .from(schema.interviewGap)
    .where(
      and(
        eq(schema.interviewGap.interviewId, interviewId),
        eq(schema.interviewGap.agencyId, agencyId),
      ),
    )
    .orderBy(asc(schema.interviewGap.startMs));
}

/** Soma o custo (USD) dos ticks da entrevista — base do teto de custo (§4). */
export async function sumTickCostUsd(
  db: Db,
  agencyId: string,
  interviewId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${schema.interviewTick.costUsd}), 0)` })
    .from(schema.interviewTick)
    .where(
      and(
        eq(schema.interviewTick.interviewId, interviewId),
        eq(schema.interviewTick.agencyId, agencyId),
      ),
    );
  return Number(row?.total ?? 0);
}

export type CostCapTier = "ok" | "alert" | "soft" | "hard";

/**
 * Pura: o estado do teto de custo (§4) — alerta 70%, soft 90% (degrada cadência), hard 100%
 * (sinaliza parar + gap `cost_cap`). `cap<=0` = sem teto configurado.
 */
export function costCapTier(totalUsd: number, capUsd: number): CostCapTier {
  if (capUsd <= 0) {
    return "ok";
  }
  const ratio = totalUsd / capUsd;
  if (ratio >= 1) {
    return "hard";
  }
  if (ratio >= 0.9) {
    return "soft";
  }
  if (ratio >= 0.7) {
    return "alert";
  }
  return "ok";
}

export interface TimeoutResult<T> {
  value: T | null;
  timedOut: boolean;
}

/**
 * Corre `fn` com timeout: se exceder `ms` devolve `{value:null, timedOut:true}` — o tick **degrada**
 * (persiste `degraded=true`), nunca bloqueia a entrevista (§0 degradação graciosa). Erros de `fn`
 * propagam (o fallback de modelo do runner §5 trata-os antes de chegar aqui).
 */
export async function runWithTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
): Promise<TimeoutResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<TimeoutResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ value: null, timedOut: true }), ms);
  });
  try {
    return await Promise.race([
      fn().then((value): TimeoutResult<T> => ({ value, timedOut: false })),
      timeout,
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
