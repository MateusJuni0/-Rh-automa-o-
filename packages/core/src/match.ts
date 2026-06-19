import { z } from "zod";

/**
 * MatchResult — comparação candidato vs vaga (PLANO-CONSTRUCAO P1.4), gerada ANTES da entrevista.
 * A escala de `matchScore` não é fixada pela spec → mantém-se sem teto no contrato (não inventar).
 */
export const matchResult = z.object({
  matchScore: z.number(),
  gapsAInvestigar: z.array(z.string()),
  pontosFortes: z.array(z.string()),
});
export type MatchResult = z.infer<typeof matchResult>;
