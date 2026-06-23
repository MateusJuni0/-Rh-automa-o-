import { z } from "zod";
import { credencialEstado, respostaCriterio } from "./enums";

/**
 * Parecer estruturado — versão CLIENTE (RELATORIO-CLIENTE §3). Renderiza-se em markdown depois.
 * Regras duras: critério não coberto assinala-se sozinho (Regra 3); inconsistências mostram-se com
 * os DOIS lados + timestamps, NUNCA com vocabulário de intenção (anti-difamação); credenciais
 * reguladas verificam-se por DOCUMENTO (§11); intervalos sem captura assinalam-se (§14).
 */

/** Resposta a um `client_criteria`, sempre com citação + timestamp (rastreável/defensável). */
export const criterioResposta = z.object({
  criterio: z.string(), // na linguagem do cliente
  resposta: respostaCriterio,
  citacao: z.string().nullable(), // null se não-confirmado
  timestamp: z.string().nullable(), // ex.: "34:12"
  leitura: z.string(), // 1 frase, linguagem do cliente
});
export type CriterioResposta = z.infer<typeof criterioResposta>;

/** Credencial regulada a verificar (§11) — nunca riscada pela profundidade da resposta. */
export const credencialVerificar = z.object({
  credencial: z.string(),
  estado: credencialEstado,
  docRef: z.string().nullable(), // documento que prova (ex.: cédula da Ordem)
});
export type CredencialVerificar = z.infer<typeof credencialVerificar>;

/** Intervalo sem captura a assinalar na fiabilidade (§14) — buraco ≠ silêncio. */
export const intervaloNaoCapturado = z.object({
  inicio: z.string(), // "HH:MM"
  fim: z.string().nullable(), // null = ainda aberto
  causa: z.string(),
});
export type IntervaloNaoCapturado = z.infer<typeof intervaloNaoCapturado>;

/** Logística (drivers de decisão do cliente). */
export const logistica = z.object({
  salario: z.string().nullable(),
  avisoPrevio: z.string().nullable(),
  disponibilidade: z.string().nullable(),
  remoto: z.string().nullable(),
  riscoContraproposta: z.string().nullable(),
});
export type Logistica = z.infer<typeof logistica>;

/** Parecer completo (7 secções + credenciais + fiabilidade). */
export const parecer = z.object({
  veredito: z.string(), // 1 linha + recomendação
  criterios: z.array(criterioResposta),
  forcas: z.array(z.string()),
  riscos: z.array(z.string()), // o que sondar / ficou raso (honesto)
  logistica,
  anguloVenda: z.string(),
  credenciaisAVerificar: z.array(credencialVerificar),
  naoCapturado: z.array(intervaloNaoCapturado),
  fontes: z.array(z.string()), // ligações aos trechos da Camada A
});
export type Parecer = z.infer<typeof parecer>;
