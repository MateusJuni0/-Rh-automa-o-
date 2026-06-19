import { randomUUID } from "node:crypto";
import {
  type Briefing,
  briefing,
  type RoleProfile,
  type Rubric,
  roleProfile,
  rubricCriterion,
} from "@rh/core";
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

export interface RoleProfileInput {
  roleType: string;
  /** Texto de pesquisa (vem da camada knowledge/search — aqui só se estrutura). */
  pesquisa: string;
}

const ROLE_PROFILE_SYSTEM = [
  "Estrutura o conhecimento de mercado de um role-type em Role Profile.",
  "oQueEBom encoda SINAIS DE PROFUNDIDADE (não keywords); linguagemFilipa traduz jargão→simples.",
  "Devolve APENAS JSON: { competencias:[{skill,nivel,obrigatorio?}], oQueEBom:{}, sinaisNivelErrado:[], linguagemFilipa:{}, perguntasChave:[], sources:[{url,acedidoEm?}] }.",
].join("\n");

/** Estrutura o resultado da pesquisa num Role Profile (CAMADA-CONHECIMENTO / P1.2). */
export function buildRoleProfile(
  input: RoleProfileInput,
  opts: RunSlotOptions,
): Promise<RoleProfile> {
  return generate(
    "ARCHITECT",
    { system: ROLE_PROFILE_SYSTEM, user: JSON.stringify(input) },
    roleProfile,
    opts,
  );
}

export interface BriefingInput {
  roleProfile: RoleProfile;
  /** Critérios da rubric com os ids canónicos — o briefing liga as perguntas a estes. */
  rubric: Array<{ requisitoId: string; requisito: string }>;
  ragCliente?: string[];
}

const BRIEFING_SYSTEM = [
  "Gera o roteiro de perguntas (briefing) em 3 lentes: 'tecnica', 'cliente', 'gap'.",
  "Para CADA pergunta dá a boaResposta esperada (do Role Profile, não genérica).",
  "Se a pergunta visa um requisito da rubric, põe o requisitoId correspondente (dos ids dados); senão null.",
  'Devolve APENAS JSON: { "perguntas": [ { "pergunta", "lente", "boaResposta", "requisitoId": uuid|null } ] }.',
].join("\n");

/** Gera o briefing (P1.5) e garante que cada requisitoId ∈ ids da rubric (senão null) — §16F. */
export async function buildBriefing(input: BriefingInput, opts: RunSlotOptions): Promise<Briefing> {
  const allowed = new Set(input.rubric.map((r) => r.requisitoId));
  const out = await generate(
    "ARCHITECT",
    { system: BRIEFING_SYSTEM, user: JSON.stringify(input) },
    briefing,
    opts,
  );
  return {
    perguntas: out.perguntas.map((q) => ({
      ...q,
      requisitoId: q.requisitoId !== null && allowed.has(q.requisitoId) ? q.requisitoId : null,
    })),
  };
}
