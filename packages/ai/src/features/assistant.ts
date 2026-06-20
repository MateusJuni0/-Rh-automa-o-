import { z } from "zod";
import { generate } from "../generate";
import type { RunSlotOptions } from "../runner";

/**
 * Feature do PLANNER do assistente pessoal (Ω-2, slot ARCHITECT). Pede ao LLM um plano em JSON
 * `{reply, toolCalls:[{tool,args}]}`, valida com Zod (no Zod do @rh/ai → tipos coerentes) e devolve
 * o objeto. SEGURANÇA: o schema NÃO tem `confirmed` — o LLM nunca contorna a porta de confirmação
 * (enforçada a jusante: a app corre com `confirmed:false` e só a confirmação humana executa
 * `gravar`/`enviar_fora`). Filtra tool-calls a ferramentas conhecidas (anti-alucinação).
 */

/** Ferramenta disponível ao planner (nome + efeito canónico). */
export interface AssistantToolInfo {
  name: string;
  efeito: string;
}

export interface AssistantPlanInput {
  message: string;
  candidatos?: readonly string[];
  clienteNome?: string | null;
  tools: ReadonlyArray<AssistantToolInfo>;
}

/** Plano normalizado devolvido ao chamador (mesma forma do mock keyword `ChatPlan`). */
export interface AssistantPlan {
  reply: string;
  toolCalls: Array<{ tool: string; args: Record<string, unknown> }>;
}

const planSchema = z.object({
  reply: z.string().min(1),
  toolCalls: z
    .array(
      z.object({
        tool: z.string().min(1),
        args: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .default([]),
});

function buildSystem(tools: ReadonlyArray<AssistantToolInfo>): string {
  const toolList = tools.map((t) => `- ${t.name} (efeito: ${t.efeito})`).join("\n");
  return [
    "És o copiloto de recrutamento da recrutadora. Responde em PT-PT, claro e direto.",
    "Decide se a mensagem precisa de ferramentas. Escolhe SÓ ferramentas desta lista:",
    toolList,
    "Regras DURAS:",
    '- Devolve APENAS JSON: { "reply": string, "toolCalls": [{ "tool": string, "args": object }] }.',
    "- Usa exatamente os nomes da lista; se nenhuma se aplica, devolve toolCalls vazio.",
    "- NUNCA marques nada como confirmado — a aprovação humana é feita fora de ti.",
    "- Não inventes resultados de ferramentas; só planeias as chamadas.",
  ].join("\n");
}

/** Planeia a resposta via LLM (validada). Filtra tool-calls a ferramentas conhecidas (fail-closed). */
export async function assistantPlan(
  input: AssistantPlanInput,
  opts: RunSlotOptions,
): Promise<AssistantPlan> {
  const known = new Set(input.tools.map((t) => t.name));
  const user = JSON.stringify({
    message: input.message.trim(),
    candidatos: input.candidatos ?? [],
    clienteNome: input.clienteNome ?? null,
  });
  const plan = await generate(
    "ARCHITECT",
    { system: buildSystem(input.tools), user },
    planSchema,
    opts,
  );
  return {
    reply: plan.reply,
    toolCalls: plan.toolCalls
      .filter((c) => known.has(c.tool))
      .map((c) => ({ tool: c.tool, args: c.args })),
  };
}
