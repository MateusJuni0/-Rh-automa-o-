import { z } from "zod";
import { criterioOrigem, criterioTipo, peso } from "./enums";

/**
 * Artefactos de avaliação do "antes" (CAMADA-CONHECIMENTO + INTAKE-E-JULGAMENTO Parte B).
 * RoleProfile = conteúdo dos 6 campos JSONB de `role_profile`; Rubric = `rubric.criteria`.
 */

/** Competência esperada de um role. `nivel` é descritivo ("obrigatório"/"desejável"); `obrigatorio` opcional. */
export const competencia = z.object({
  skill: z.string(),
  nivel: z.string(),
  obrigatorio: z.boolean().optional(),
});
export type Competencia = z.infer<typeof competencia>;

/** Fonte consultada (proveniência do conhecimento externo). */
export const roleProfileSource = z.object({
  url: z.string(),
  acedidoEm: z.string().optional(),
});

/**
 * RoleProfile — conhecimento de mercado por role-type. `oQueEBom` encoda SINAIS DE PROFUNDIDADE
 * (não keywords de tecnologia); `linguagemFilipa` traduz jargão→simples.
 */
export const roleProfile = z.object({
  competencias: z.array(competencia),
  oQueEBom: z.record(z.string(), z.string()),
  sinaisNivelErrado: z.array(z.string()),
  linguagemFilipa: z.record(z.string(), z.string()),
  perguntasChave: z.array(z.string()),
  sources: z.array(roleProfileSource),
});
export type RoleProfile = z.infer<typeof roleProfile>;

/** Gabarito fraco/ok/forte de um requisito, em linguagem simples. */
export const rubricLevels = z.object({
  fraco: z.string(),
  ok: z.string(),
  forte: z.string(),
});

/** Critério da rubric. Keia por `requisitoId` (§16F estável através de rubric.version); texto = display. */
export const rubricCriterion = z.object({
  requisitoId: z.uuid(),
  requisito: z.string(),
  perguntaSonda: z.string(),
  fraco: z.string(),
  ok: z.string(),
  forte: z.string(),
  linguagemFilipa: rubricLevels,
  peso,
  origem: criterioOrigem,
  originCriteriaId: z.uuid().nullable(), // FK lógica → client_criteria, se a origem inclui o cliente
  tipo: criterioTipo, // competencia (profundidade) | credencial (documento, §11)
});
export type RubricCriterion = z.infer<typeof rubricCriterion>;

/** Rubric — conjunto de critérios + versão (versionamento mid-process §8). */
export const rubric = z.object({
  version: z.number().int().min(1),
  criteria: z.array(rubricCriterion),
});
export type Rubric = z.infer<typeof rubric>;
