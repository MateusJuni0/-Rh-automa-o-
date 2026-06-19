import { z } from "zod";
import { lente } from "./enums";

/**
 * Protocolo WebSocket painel↔overlay (ARQUITETURA-INTEGRACAO §2.4 + AGENTE-TOOLS-E-WS + AUTENTICACAO §4).
 * Frozen no P0.1: discriminador `type`, envelope fiável (`v`+`seq`), `ack`/`last_seq` p/ replay na reconexão,
 * frames de controlo de auth, close codes 44xx. O payload `estado`/`requisitos` aperta-se na fatia de AI shapes.
 */

/** Versão do protocolo (campo `v`) — evoluir frames sem partir clientes. */
export const WS_PROTOCOL_VERSION = 1;

/** Close codes 44xx (recusa = close, não mensagem normal). */
export const WS_CLOSE = {
  AUTH_REQUIRED: 4401,
  FORBIDDEN: 4403,
} as const;

const authErrorCode = z.union([z.literal(WS_CLOSE.AUTH_REQUIRED), z.literal(WS_CLOSE.FORBIDDEN)]);

// ──────────────────────────── Cliente → Servidor ────────────────────────────

/** 1ª mensagem do cliente: JWT no corpo (NUNCA em query-string — AUTENTICACAO §4). */
export const wsAuth = z.object({
  type: z.literal("auth"),
  accessToken: z.string().min(1),
  interviewId: z.uuid(),
});

/** Ack do cliente: último `seq` recebido → o servidor faz replay do que faltou na reconexão. */
export const wsAck = z.object({
  type: z.literal("ack"),
  lastSeq: z.number().int().nonnegative(),
});

export const clientMessage = z.discriminatedUnion("type", [wsAuth, wsAck]);
export type ClientMessage = z.infer<typeof clientMessage>;

// ──────────────────────────── Servidor → Cliente ────────────────────────────
// Envelope fiável: todo o frame de servidor leva `v` (versão) + `seq` (monótono).
const env = { v: z.number().int(), seq: z.number().int().nonnegative() };

export const wsAuthOk = z.object({ ...env, type: z.literal("auth.ok") });
export const wsAuthError = z.object({ ...env, type: z.literal("auth.error"), code: authErrorCode });
export const wsAuthRefreshNeeded = z.object({ ...env, type: z.literal("auth.refresh_needed") });

export const wsTickUpdate = z.object({
  ...env,
  type: z.literal("tick.update"),
  interviewId: z.uuid(),
  // EstadoVivo — placeholder; aperta-se na fatia de AI shapes (ARQUITETURA-TEMPO-REAL §2).
  estado: z.record(z.string(), z.unknown()),
});

export const wsSuggestionNext = z.object({
  ...env,
  type: z.literal("suggestion.next"),
  interviewId: z.uuid(),
  pergunta: z.string(),
  lente,
  requisitoId: z.uuid().nullable(), // família F: keia por id, não texto
});

export const wsCoverageUpdate = z.object({
  ...env,
  type: z.literal("coverage.update"),
  interviewId: z.uuid(),
  requisitos: z.array(z.object({ requisitoId: z.uuid(), status: z.string() })),
});

export const wsAlert = z.object({
  ...env,
  type: z.literal("alert"),
  interviewId: z.uuid(),
  texto: z.string(),
});

export const wsInterviewActive = z.object({
  ...env,
  type: z.literal("interview.active"),
  interviewId: z.uuid(),
  on: z.boolean(),
});

/** Progresso de ferramenta longa do agente (sourcing…) — jobId → async_job (§12). */
export const wsJobProgress = z.object({
  ...env,
  type: z.literal("job.progress"),
  jobId: z.uuid(),
  estado: z.string(),
  pct: z.number().min(0).max(100),
});

export const wsJobDone = z.object({
  ...env,
  type: z.literal("job.done"),
  jobId: z.uuid(),
  resultRef: z.string(),
});

export const serverMessage = z.discriminatedUnion("type", [
  wsAuthOk,
  wsAuthError,
  wsAuthRefreshNeeded,
  wsTickUpdate,
  wsSuggestionNext,
  wsCoverageUpdate,
  wsAlert,
  wsInterviewActive,
  wsJobProgress,
  wsJobDone,
]);
export type ServerMessage = z.infer<typeof serverMessage>;
