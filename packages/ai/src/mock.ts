import type { ModelEntry, SlotAssignment } from "./registry";
import type { LlmRequest, LlmResponse, LlmTransport, RunSlotOptions } from "./runner";

/**
 * Infra de MOCK para dev/testes — corre o cérebro SEM chaves nem chamadas pagas.
 * Quando o `OPENROUTER_API_KEY` chegar, troca-se o transporte mock pelo real (ver KEYS-TODO.md).
 */

/** Modelo mock: declara os 3 slots + capacidades + ZDR (passa o gate). Só dev/testes. */
export const MOCK_MODEL: ModelEntry = {
  id: "mock/echo",
  slots: ["EXTRACTOR", "ARCHITECT", "LIVE"],
  supportsJson: true,
  supportsTools: true,
  supportsStreaming: true,
  maxContext: 200000,
  zdr: true,
};

export const mockRegistry: readonly ModelEntry[] = [MOCK_MODEL];

/** Atribuição de slots (para `validateRegistry`). */
export const mockSlots: SlotAssignment = {
  EXTRACTOR: MOCK_MODEL.id,
  ARCHITECT: MOCK_MODEL.id,
  LIVE: MOCK_MODEL.id,
};

/** Listas de fallback (para `runSlot`/`generate`). */
export const mockFallback: Record<keyof SlotAssignment, readonly string[]> = {
  EXTRACTOR: [MOCK_MODEL.id],
  ARCHITECT: [MOCK_MODEL.id],
  LIVE: [MOCK_MODEL.id],
};

/** Transporte mock: `respond(req)` → `content`. Default ecoa `{}`. */
export function mockTransport(respond: (req: LlmRequest) => string = () => "{}"): LlmTransport {
  return {
    complete(modelId: string, req: LlmRequest): Promise<LlmResponse> {
      return Promise.resolve({ modelId, content: respond(req) });
    },
  };
}

/** `RunSlotOptions` pronto com o registry/fallback mock + um transporte (canned responses). */
export function mockRunSlotOptions(respond?: (req: LlmRequest) => string): RunSlotOptions {
  return { registry: mockRegistry, fallback: mockFallback, transport: mockTransport(respond) };
}
