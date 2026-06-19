import { z } from "zod";

/**
 * Registry de modelos por SLOT + gate ZDR (MODELOS-E-API §3, SEGURANCA §7, contrato FASE-3-ARRANQUE §3).
 * Os 3 slots de chat veem PII (transcrição/CV/parecer/saúde) → o roteamento é restrito a providers
 * com `zdr:true` (retenção-zero / no-training), fail-closed. O "deploy falha" = `validateRegistry`
 * devolver violações (ou `assertRegistryValid` lançar).
 */

/** Slots de capacidade (a Filipa escolhe o modelo de cada um em Definições). */
export const slot = z.enum(["EXTRACTOR", "ARCHITECT", "LIVE"]);
export type Slot = z.infer<typeof slot>;

/** Entrada do registry: cada modelo DECLARA capacidades, não só o id. */
export const modelEntry = z.object({
  id: z.string().min(1), // ex.: "anthropic/claude-sonnet-4-6"
  slots: z.array(slot), // slots p/ que o modelo é elegível
  supportsJson: z.boolean(),
  supportsTools: z.boolean(),
  supportsStreaming: z.boolean(),
  supportsPromptCache: z.boolean().optional(),
  maxContext: z.number().int().positive(),
  costIn: z.number().nonnegative().optional(),
  costOut: z.number().nonnegative().optional(),
  zdr: z.boolean(), // zero-data-retention do provider — obrigatório p/ slots com PII
});
export type ModelEntry = z.infer<typeof modelEntry>;

/** Atribuição slot → id de modelo. Todos os slots têm de estar configurados. */
export const slotAssignment = z.object({
  EXTRACTOR: z.string().min(1),
  ARCHITECT: z.string().min(1),
  LIVE: z.string().min(1),
});
export type SlotAssignment = z.infer<typeof slotAssignment>;

/**
 * Capacidades estáticas exigidas por slot (a latência do LIVE mede-se em runtime, não aqui).
 * LIVE: streaming+tools+json · ARCHITECT: json+tools (+contexto longo, qualitativo) · EXTRACTOR: json.
 */
const SLOT_REQUIREMENTS: Record<Slot, (m: ModelEntry) => boolean> = {
  EXTRACTOR: (m) => m.supportsJson,
  ARCHITECT: (m) => m.supportsJson && m.supportsTools,
  LIVE: (m) => m.supportsJson && m.supportsTools && m.supportsStreaming,
};

export type ViolationReason =
  | "modelo_inexistente"
  | "slot_nao_declarado"
  | "sem_zdr"
  | "capacidade_em_falta";

export interface RegistryViolation {
  slot: Slot;
  modelId: string;
  reason: ViolationReason;
}

/**
 * Razões pelas quais um modelo (que JÁ existe no registry) NÃO é elegível para um slot.
 * Vazio = elegível. Usado tanto pela validação de config como pelo runner (fallback fail-closed).
 */
export function modelIssuesForSlot(model: ModelEntry, s: Slot): ViolationReason[] {
  const issues: ViolationReason[] = [];
  if (!model.slots.includes(s)) {
    issues.push("slot_nao_declarado");
  }
  if (!model.zdr) {
    issues.push("sem_zdr");
  }
  if (!SLOT_REQUIREMENTS[s](model)) {
    issues.push("capacidade_em_falta");
  }
  return issues;
}

/**
 * Valida a config de slots contra o registry. Cada slot que apontar a um modelo inexistente,
 * que não declara o slot, **sem `zdr:true`** (gate de PII), ou sem as capacidades do slot → violação.
 * Deploy só avança com zero violações.
 */
export function validateRegistry(
  registry: readonly ModelEntry[],
  slots: SlotAssignment,
): RegistryViolation[] {
  const byId = new Map(registry.map((m) => [m.id, m]));
  const violations: RegistryViolation[] = [];

  for (const s of slot.options) {
    const modelId = slots[s];
    const model = byId.get(modelId);
    if (!model) {
      violations.push({ slot: s, modelId, reason: "modelo_inexistente" });
      continue;
    }
    for (const reason of modelIssuesForSlot(model, s)) {
      violations.push({ slot: s, modelId, reason });
    }
  }

  return violations;
}

/** Lança se houver violações (gate de deploy fail-closed). */
export function assertRegistryValid(registry: readonly ModelEntry[], slots: SlotAssignment): void {
  const violations = validateRegistry(registry, slots);
  if (violations.length > 0) {
    const summary = violations.map((v) => `${v.slot}=${v.modelId}:${v.reason}`).join("; ");
    throw new Error(`config de modelos inválida (deploy bloqueado): ${summary}`);
  }
}
