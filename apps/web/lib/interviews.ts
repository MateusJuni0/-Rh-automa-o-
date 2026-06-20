import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, eq } from "drizzle-orm";
import { gerarParecer } from "./parecer";

type Db = DbHandle["db"];

export type InterviewStatus = "scheduled" | "live" | "done" | "unstructured";

/** Transições válidas do ciclo de vida (scheduled→live→done; órfã = 'unstructured' §12). */
const ALLOWED: Record<InterviewStatus, readonly InterviewStatus[]> = {
  scheduled: ["live", "done"], // tem processo por construção → nunca vira órfã
  live: ["done"],
  done: [],
  unstructured: ["live", "done"],
};

function isStatus(s: string): s is InterviewStatus {
  return s === "scheduled" || s === "live" || s === "done" || s === "unstructured";
}

export interface CreateInterviewParams {
  recruiterId: string;
  processId?: string | null;
  /** RGPD: atribui a entrevista ao candidato (incl. órfã sem processo) → purgável. Best-effort. */
  candidateId?: string | null;
}

export interface CreatedInterview {
  interviewId: string;
  room: string;
  token: string;
}

/**
 * Inicia uma entrevista (ARQUITETURA-INTEGRACAO §2.3 `POST /api/interviews`). Sem processo = órfã
 * (cold-start §12, status 'unstructured'); com processo = 'live'. `room`/`token` são MOCK (LiveKit
 * real = handover, KEYS-TODO) — inertes, sem segredos. `captureType:'none'` (v1 sem áudio).
 */
export async function createInterview(
  db: Db,
  agencyId: string,
  params: CreateInterviewParams,
): Promise<CreatedInterview> {
  const interviewId = randomUUID();
  // room/token MOCK efémeros por design: não persistem (o schema não tem coluna de token);
  // o token LiveKit real (assinado, recuperável) entra com a chave na Fase Ω. KEYS-TODO.
  const room = `mock-room-${interviewId}`;
  // RGPD: deriva o candidato do processo (best-effort) ou usa o override explícito (órfã cold-start).
  let candidateId = params.candidateId ?? null;
  if (candidateId === null && params.processId) {
    const [proc] = await db
      .select({ candidateId: schema.process.candidateId })
      .from(schema.process)
      .where(and(eq(schema.process.id, params.processId), eq(schema.process.agencyId, agencyId)));
    candidateId = proc?.candidateId ?? null;
  }
  await db.insert(schema.interview).values({
    id: interviewId,
    agencyId,
    processId: params.processId ?? null,
    candidateId,
    recruiterId: params.recruiterId,
    status: params.processId ? "live" : "unstructured",
    captureType: "none",
    livekitRoom: room,
  });
  return { interviewId, room, token: `mock-token-${interviewId}` };
}

export interface InterviewRow {
  id: string;
  status: string;
  recruiterId: string;
  processId: string | null;
  livekitRoom: string | null;
}

export async function getInterview(
  db: Db,
  agencyId: string,
  interviewId: string,
): Promise<InterviewRow | null> {
  const [row] = await db
    .select({
      id: schema.interview.id,
      status: schema.interview.status,
      recruiterId: schema.interview.recruiterId,
      processId: schema.interview.processId,
      livekitRoom: schema.interview.livekitRoom,
    })
    .from(schema.interview)
    .where(and(eq(schema.interview.id, interviewId), eq(schema.interview.agencyId, agencyId)));
  return row ?? null;
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: InterviewStatus,
  ) {
    super(`transição inválida: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * Avança o estado da entrevista com guarda de transições + CAS por status atual (a UPDATE só toca
 * a linha se o status ainda for o que lemos → sem corrida). Idempotente quando `to` == atual.
 */
export async function transitionInterview(
  db: Db,
  agencyId: string,
  interviewId: string,
  to: InterviewStatus,
): Promise<InterviewStatus> {
  const current = await getInterview(db, agencyId, interviewId);
  if (!current) {
    throw new Error("entrevista inexistente nesta agência");
  }
  if (!isStatus(current.status)) {
    throw new InvalidTransitionError(current.status, to);
  }
  if (current.status === to) {
    return to;
  }
  if (!ALLOWED[current.status].includes(to)) {
    throw new InvalidTransitionError(current.status, to);
  }
  const updated = await db
    .update(schema.interview)
    .set({ status: to, ...(to === "done" ? { endedAt: new Date() } : {}) })
    .where(
      and(
        eq(schema.interview.id, interviewId),
        eq(schema.interview.agencyId, agencyId),
        eq(schema.interview.status, current.status),
      ),
    )
    .returning({ status: schema.interview.status });
  if (updated.length === 0) {
    // CAS perdeu: re-lê. Se outra transição concorrente já levou ao mesmo destino → idempotente.
    const after = await getInterview(db, agencyId, interviewId);
    if (after?.status === to) {
      return to;
    }
    throw new InvalidTransitionError(current.status, to);
  }
  return to;
}

export class InterviewNotFoundError extends Error {
  constructor(readonly interviewId: string) {
    super(`entrevista inexistente: ${interviewId}`);
    this.name = "InterviewNotFoundError";
  }
}

/**
 * `POST /api/interviews/:id/join` — "vou para uma reunião": garante a sala/token (MOCK) e transita
 * a entrevista para 'live'. Idempotente se já 'live'; lança `InvalidTransitionError` se já 'done'.
 */
export async function joinInterview(
  db: Db,
  agencyId: string,
  interviewId: string,
): Promise<CreatedInterview> {
  const row = await getInterview(db, agencyId, interviewId);
  if (!row) {
    throw new InterviewNotFoundError(interviewId);
  }
  await transitionInterview(db, agencyId, interviewId, "live");
  return {
    interviewId,
    room: row.livekitRoom ?? `mock-room-${interviewId}`,
    token: `mock-token-${interviewId}`,
  };
}

/**
 * `POST /api/interviews/:id/report` — o desktop chama isto ao encerrar: transita p/ 'done' e gera o
 * parecer no backend (FASE E `gerarParecer`). Idempotente (done→done; re-gera o parecer).
 */
export async function reportInterview(
  db: Db,
  agencyId: string,
  interviewId: string,
): Promise<Awaited<ReturnType<typeof gerarParecer>>> {
  const row = await getInterview(db, agencyId, interviewId);
  if (!row) {
    throw new InterviewNotFoundError(interviewId);
  }
  await transitionInterview(db, agencyId, interviewId, "done");
  return gerarParecer(db, agencyId, { interviewId });
}
