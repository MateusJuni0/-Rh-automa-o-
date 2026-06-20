import { assistantPlan, type RunSlotOptions } from "@rh/ai";
import type { ChatContext, ChatPlan } from "./chat";
import type { ToolDef } from "./tools";

/**
 * Planner REAL do assistente (Ω-2) — thin wrapper sobre `@rh/ai assistantPlan` (slot ARCHITECT).
 * O schema/prompt/validação vivem no @rh/ai (Zod coerente; o web usa outra versão de Zod). Aqui só
 * adaptamos a forma `{message, ctx, tools}` → `AssistantPlanInput` e o resultado → `ChatPlan`.
 *
 * SEGURANÇA: a porta de confirmação mantém-se enforçada a jusante (`run.ts` corre com
 * `confirmed:false`; só `confirmAction` executa `gravar`/`enviar_fora`). O LLM nunca marca confirmação.
 */

export interface PlanWithLlmInput {
  message: string;
  ctx: ChatContext;
  /** Ferramentas disponíveis (nome + efeito) — o prompt lista-as ao modelo. */
  tools: ReadonlyArray<Pick<ToolDef, "name" | "efeito">>;
}

/** Planeia a resposta via LLM e mapeia ao `ChatPlan` (mesmo formato do mock keyword). */
export async function planResponseWithLlm(
  input: PlanWithLlmInput,
  opts: RunSlotOptions,
): Promise<ChatPlan> {
  const plan = await assistantPlan(
    {
      message: input.message,
      candidatos: input.ctx.candidatos,
      clienteNome: input.ctx.clienteNome ?? null,
      tools: input.tools.map((t) => ({ name: t.name, efeito: t.efeito })),
    },
    opts,
  );
  return { reply: plan.reply, toolCalls: plan.toolCalls };
}
