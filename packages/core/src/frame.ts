import { z } from "zod";
import { confianca, lente } from "./enums";

/**
 * Frame de avaliação / estado vivo da entrevista (ARQUITETURA-TEMPO-REAL §2 + §9).
 * Vista comprimida de trabalho (Camada B) — a fonte de verdade é a Camada A (transcript_chunk).
 * Família F: os requisitos keiam por `requisitoId` (UUID estável), não por texto; o texto é só display
 * (o exemplo do doc keava por nome — pré-família-F; aqui aplica-se a forma canónica).
 */

/** Os 4 estados canónicos de um requisito (máquina de estados §9). */
export const requisitoStatus = z.enum(["não-tocado", "raso", "coberto-com-prova", "contradito"]);
export type RequisitoStatus = z.infer<typeof requisitoStatus>;

/** Cobertura de um requisito no frame. */
export const requisitoCoverage = z.object({
  requisitoId: z.uuid(),
  display: z.string(), // texto p/ a Filipa (linguagem simples)
  status: requisitoStatus,
  confianca: confianca.optional(),
  evidencia: z.string().optional(), // ex.: "12:03 descreveu reconciliation"
});
export type RequisitoCoverage = z.infer<typeof requisitoCoverage>;

/** O que ESTE cliente quereria saber (lente do cliente). */
export const interesseClienteCoverage = z.object({
  tema: z.string(),
  status: requisitoStatus,
  evidencia: z.string().optional(),
});
export type InteresseClienteCoverage = z.infer<typeof interesseClienteCoverage>;

/** Afirmação do candidato com possível conflito vs CV (§13 inconsistência). */
export const afirmacaoCandidato = z.object({
  t: z.string(), // timestamp na entrevista, ex.: "11:58"
  diz: z.string(),
  conflitoCv: z.string().optional(),
});
export type AfirmacaoCandidato = z.infer<typeof afirmacaoCandidato>;

/** Estado vivo comprimido enviado/recebido a cada tick (custo constante, não cresce com a duração). */
export const estadoVivo = z.object({
  requisitos: z.array(requisitoCoverage),
  interessesCliente: z.array(interesseClienteCoverage),
  afirmacoesCandidato: z.array(afirmacaoCandidato),
  perguntasFeitas: z.array(z.string()),
  redFlags: z.array(z.string()),
  resumoCorrente: z.string(), // rolling summary destilado
});
export type EstadoVivo = z.infer<typeof estadoVivo>;

/** Próxima sugestão do copiloto, por lente. requisitoId nulável (sugestão geral, não ligada a 1 requisito). */
export const suggestion = z.object({
  pergunta: z.string(),
  lente,
  requisitoId: z.uuid().nullable(),
});
export type Suggestion = z.infer<typeof suggestion>;
