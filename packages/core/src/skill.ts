import { z } from "zod";

/**
 * Contrato de SAÍDA das skills (família J — REUSE-MAP §4 / AGENTE-TOOLS A.3): a skill/wrapper devolve
 * **JSON**, nunca prosa+CSV. O handler mapeia `status` → `assistant_action.status` (sem sucesso falso);
 * ficheiros gerados → Storage path em `result_ref`.
 */
export const skillStatus = z.enum(["ok", "empty", "failed"]);
export type SkillStatus = z.infer<typeof skillStatus>;

export const skillResult = z.object({
  status: skillStatus,
  artifactPath: z.string().optional(), // → assistant_action.result_ref
  itemsCount: z.number().int().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  error: z.string().optional(),
});
export type SkillResult = z.infer<typeof skillResult>;
