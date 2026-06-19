import { z } from "zod";

/**
 * Idempotência de writes (ARQUITETURA-INTEGRACAO §8): header `Idempotency-Key` (UUID do cliente)
 * → repetir devolve o mesmo resultado (não duplica candidato/process/envio). Famílias I (enviar_fora).
 */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

export const idempotencyKey = z.uuid();
export type IdempotencyKey = z.infer<typeof idempotencyKey>;
