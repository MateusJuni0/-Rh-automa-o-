import { z } from "zod";

/**
 * Envelope de resposta da API (ARQUITETURA-INTEGRACAO §8): `{ ok:true, data } | { ok:false, error }`.
 * Fonte única — os route handlers e os clientes constroem contra isto.
 */
export const errorCode = z.enum([
  "validation", // 400
  "unauthorized", // 401
  "forbidden", // 403
  "not_found", // 404
  "conflict", // 409 (idempotência / conflito)
  "internal", // 5xx
]);
export type ErrorCode = z.infer<typeof errorCode>;

export const apiError = z.object({
  code: errorCode,
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof apiError>;

/** Constrói o schema do envelope para um dado schema de `data`. */
export function apiResponse<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: apiError }),
  ]);
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export const ok = <T>(data: T): ApiResponse<T> => ({ ok: true, data });

export function err(code: ErrorCode, message: string, details?: unknown): ApiResponse<never> {
  const error: ApiError = details === undefined ? { code, message } : { code, message, details };
  return { ok: false, error };
}

/** Mapa código → estado HTTP (ARQUITETURA-INTEGRACAO §8). */
export const HTTP_STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  internal: 500,
};
