import { z } from "zod";
import { lente } from "./enums";

/**
 * Briefing (roteiro) — PLANO P1.5. Perguntas em 3 lentes (técnica/cliente/gap), cada uma com a
 * "boa resposta" esperada (extraída do Role Profile, não genérica). §16F: liga ao requisito por id.
 */
export const briefingQuestion = z.object({
  pergunta: z.string(),
  lente,
  boaResposta: z.string(),
  requisitoId: z.uuid().nullable(),
});
export type BriefingQuestion = z.infer<typeof briefingQuestion>;

export const briefing = z.object({
  perguntas: z.array(briefingQuestion),
});
export type Briefing = z.infer<typeof briefing>;
