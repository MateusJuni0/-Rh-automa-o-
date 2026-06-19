import { randomUUID } from "node:crypto";
import { type RoleProfile, type Rubric, rubricCriterion } from "@rh/core";
import { z } from "zod";
import { generate } from "../generate";
import type { RunSlotOptions } from "../runner";

/**
 * Features de PREPARAÇÃO ("antes") do cérebro (slot ARCHITECT).
 * §16F: o LLM gera o CONTEÚDO dos critérios; o `requisitoId` (id canónico estável) é atribuído
 * pelo SISTEMA — nunca pelo modelo (UUIDs gerados por LLM não são fiáveis nem estáveis).
 */

export interface RubricInput {
  roleProfile: RoleProfile;
  clientCriteria: Array<{ criterio: string; peso: string }>;
}

/** O schema que o LLM preenche: um critério SEM `requisitoId`. */
const draftCriterion = rubricCriterion.omit({ requisitoId: true });
const draftRubric = z.object({ criteria: z.array(draftCriterion) });

const RUBRIC_SYSTEM = [
  "Gera o gabarito (rubric) de avaliação a partir do Role Profile + critérios do cliente.",
  "Para CADA requisito: pergunta_sonda, e os níveis fraco/ok/forte (o que distingue cada um),",
  "linguagem_filipa {fraco,ok,forte} (explicação simples), peso (must|normal|nice),",
  "origem (role_profile|client_criteria|ambos), originCriteriaId (uuid|null),",
  "tipo (competencia = prova-se por profundidade | credencial = prova-se por documento).",
  "NÃO geres ids de requisito — o sistema atribui-os.",
  'Devolve APENAS JSON: { "criteria": [ { requisito, perguntaSonda, fraco, ok, forte, linguagemFilipa, peso, origem, originCriteriaId, tipo } ] }.',
].join("\n");

/** Gera a Rubric (INTAKE-E-JULGAMENTO Parte B) e atribui o `requisitoId` canónico a cada critério. */
export async function buildRubric(input: RubricInput, opts: RunSlotOptions): Promise<Rubric> {
  const draft = await generate(
    "ARCHITECT",
    { system: RUBRIC_SYSTEM, user: JSON.stringify(input) },
    draftRubric,
    opts,
  );
  return {
    version: 1,
    criteria: draft.criteria.map((c) => ({ ...c, requisitoId: randomUUID() })),
  };
}
