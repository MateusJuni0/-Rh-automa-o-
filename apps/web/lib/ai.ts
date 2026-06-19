import {
  createOpenRouterTransport,
  type ModelEntry,
  mockRunSlotOptions,
  type RunSlotOptions,
  type Slot,
} from "@rh/ai";

/** A IA real está ligada quando há chave do OpenRouter. Sem ela, usa-se o stub demo. */
export const AI_ENABLED = Boolean(process.env.OPENROUTER_API_KEY);

const DEFAULTS: Record<Slot, string> = {
  EXTRACTOR: "anthropic/claude-haiku-4-5",
  ARCHITECT: "anthropic/claude-opus-4-8",
  LIVE: "anthropic/claude-sonnet-4-6",
};

function realConfig(): { registry: ModelEntry[]; fallback: Record<Slot, readonly string[]> } {
  const byId = new Map<string, Slot[]>();
  const fallback = {} as Record<Slot, readonly string[]>;
  for (const slot of ["EXTRACTOR", "ARCHITECT", "LIVE"] as const) {
    const id = process.env[`MODEL_${slot}`] ?? DEFAULTS[slot];
    fallback[slot] = [id];
    byId.set(id, [...(byId.get(id) ?? []), slot]);
  }
  // Capacidades/ZDR placeholder — o deployment afina por modelo (Mateus valida a data-policy). zdr:true
  // é obrigatório para slots com PII; o gate (@rh/ai validateRegistry) recusa se algum slot não tiver.
  const registry: ModelEntry[] = [...byId.entries()].map(([id, slots]) => ({
    id,
    slots,
    supportsJson: true,
    supportsTools: true,
    supportsStreaming: true,
    maxContext: 200000,
    zdr: true,
  }));
  return { registry, fallback };
}

/**
 * Opções para correr um slot de IA. Com `OPENROUTER_API_KEY` → transporte OpenRouter real (wiring
 * final, ver KEYS-TODO.md). Sem chave → transporte que devolve `stub` (canned determinístico que a
 * rota fornece para a sua feature) — o fluxo é demo-able sem custo. NUNCA hardcodar chaves.
 */
export function aiOptions(stub: unknown): RunSlotOptions {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return mockRunSlotOptions(() => JSON.stringify(stub));
  }
  const { registry, fallback } = realConfig();
  return { registry, fallback, transport: createOpenRouterTransport({ apiKey }) };
}
