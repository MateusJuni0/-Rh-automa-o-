import { type ModelEntry, modelIssuesForSlot, type Slot } from "./registry";

/** Pedido mínimo ao LLM (aperta-se quando o transporte real OpenRouter entrar). */
export interface LlmRequest {
  messages: ReadonlyArray<{ role: string; content: string }>;
  json?: boolean;
}

export interface LlmResponse {
  modelId: string;
  content: string;
}

/** Erro do transporte. `transient` (429/timeout/5xx) → tenta o próximo modelo; `permanent` → propaga. */
export class LlmTransportError extends Error {
  readonly kind: "transient" | "permanent";
  readonly status: number | undefined;
  constructor(kind: "transient" | "permanent", message: string, status?: number) {
    super(message);
    this.name = "LlmTransportError";
    this.kind = kind;
    this.status = status;
  }
}

/** Transporte injetável — mock em teste; real = OpenRouter (fetch) numa fatia seguinte. */
export interface LlmTransport {
  complete(modelId: string, req: LlmRequest): Promise<LlmResponse>;
}

export interface RunSlotOptions {
  registry: readonly ModelEntry[];
  /** Listas ordenadas por slot (primário→secundário…) — a Filipa edita em Definições (§5). */
  fallback: Partial<Record<Slot, readonly string[]>>;
  transport: LlmTransport;
}

/** A lista do slot esgotou (todos saltados/falharam). */
export class SlotExhaustedError extends Error {
  readonly slot: Slot;
  readonly skipped: readonly string[];
  readonly lastError: LlmTransportError | undefined;
  constructor(slot: Slot, skipped: readonly string[], lastError?: LlmTransportError) {
    super(`slot ${slot} esgotou os modelos (saltados: ${skipped.join(", ") || "nenhum"})`);
    this.name = "SlotExhaustedError";
    this.slot = slot;
    this.skipped = skipped;
    this.lastError = lastError;
  }
}

/**
 * Corre um slot tentando os modelos da sua lista ordenada (§5). Só chama modelos ELEGÍVEIS
 * (existem + ZDR + declaram o slot + capacidades — fail-closed: nunca manda PII a um provider
 * sem retenção-zero, mesmo em fallback). Falha transitória → próximo; permanente → propaga;
 * lista esgotada → `SlotExhaustedError`.
 */
export async function runSlot(
  slot: Slot,
  req: LlmRequest,
  opts: RunSlotOptions,
): Promise<LlmResponse> {
  const byId = new Map(opts.registry.map((m) => [m.id, m]));
  const list = opts.fallback[slot] ?? [];
  const skipped: string[] = [];
  let lastError: LlmTransportError | undefined;

  for (const modelId of list) {
    const model = byId.get(modelId);
    if (!model || modelIssuesForSlot(model, slot).length > 0) {
      skipped.push(modelId);
      continue;
    }
    try {
      return await opts.transport.complete(modelId, req);
    } catch (e) {
      const err =
        e instanceof LlmTransportError ? e : new LlmTransportError("permanent", String(e));
      if (err.kind === "permanent") {
        throw err;
      }
      lastError = err; // transitória → desce na lista
    }
  }

  throw new SlotExhaustedError(slot, skipped, lastError);
}
