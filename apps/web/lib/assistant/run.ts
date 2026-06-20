import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, eq } from "drizzle-orm";
import { AI_ENABLED, aiOptions } from "../ai";
import { type ChatContext, type ChatPlan, planResponse } from "./chat";
import { createMemoryStore, executeToolCall } from "./gate";
import { planResponseWithLlm } from "./llm";
import { saveMemoryFact } from "./memory";
import { getTool, TOOLS, validateToolArgs } from "./tools";

type Db = DbHandle["db"];

export interface ActionView {
  actionId: string;
  tool: string;
  efeito: string;
  status: string;
  summary?: string;
  resultRef?: string;
}

export interface AssistantTurn {
  threadId: string;
  reply: string;
  actions: ActionView[];
}

/** Narrowing seguro do JSONB `args` (após verificação de runtime, não cego). */
function asArgs(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

async function ensureThread(
  db: Db,
  agencyId: string,
  recruiterId: string,
  threadId?: string,
): Promise<string> {
  if (threadId) {
    const [t] = await db
      .select({ id: schema.assistantThread.id })
      .from(schema.assistantThread)
      .where(
        and(
          eq(schema.assistantThread.id, threadId),
          eq(schema.assistantThread.agencyId, agencyId),
          eq(schema.assistantThread.recruiterId, recruiterId),
        ),
      );
    if (t) {
      return t.id;
    }
  }
  const id = randomUUID();
  await db.insert(schema.assistantThread).values({ id, agencyId, recruiterId });
  return id;
}

/** Lista de ferramentas (nome + efeito) que o planner LLM pode escolher. */
const TOOL_INFO = Object.values(TOOLS).map((t) => ({ name: t.name, efeito: t.efeito }));

/**
 * Escolhe o plano (config-not-code): com chave de IA → planner LLM (slot ARCHITECT). Se o LLM
 * falhar (rede/parse/slot esgotado), **degrada** para o keyword mock — sem silêncio: a degradação
 * é determinística e o mock é sempre coerente. Sem chave → keyword mock direto (testes a €0).
 */
async function planFor(message: string, ctx: ChatContext): Promise<ChatPlan> {
  if (!AI_ENABLED) {
    return planResponse(message, ctx);
  }
  try {
    return await planResponseWithLlm({ message, ctx, tools: TOOL_INFO }, aiOptions(undefined));
  } catch {
    // Fallback determinístico: o assistente nunca fica sem resposta por falha do LLM.
    return planResponse(message, ctx);
  }
}

/**
 * Uma mensagem nova: persiste-a, planeia, corre as tools pela PORTA com `confirmed:false` (a
 * confirmação só acontece em `confirmAction`). As `gravar`/`enviar_fora` ficam `pending_confirm`.
 */
export async function runMessage(
  db: Db,
  agencyId: string,
  recruiterId: string,
  params: { message: string; threadId?: string; ctx?: ChatContext },
): Promise<AssistantTurn> {
  const threadId = await ensureThread(db, agencyId, recruiterId, params.threadId);
  await db.insert(schema.assistantMessage).values({
    id: randomUUID(),
    threadId,
    agencyId,
    role: "recruiter",
    content: params.message,
  });

  const plan = await planFor(params.message, params.ctx ?? {});
  const actions: ActionView[] = [];
  const store = createMemoryStore();
  for (const call of plan.toolCalls) {
    const tool = getTool(call.tool);
    if (!tool) {
      continue;
    }
    // Anti prompt-injection: o LLM produz os `args`; se não baterem com o `argsSchema` da tool
    // (ex.: `enviar_email` para um domínio fora da allowlist), DESCARTA a tool-call ao planear —
    // nunca chega a ficar pendente nem a pedir confirmação com args envenenados.
    const checked = validateToolArgs(call.tool, call.args);
    if (checked && !checked.ok) {
      continue;
    }
    const outcome = executeToolCall({ tool: call.tool, args: call.args, confirmed: false }, store);
    const actionId = randomUUID();
    if (outcome.status === "needs_confirm") {
      await db.insert(schema.assistantAction).values({
        id: actionId,
        agencyId,
        recruiterId,
        threadId,
        tool: call.tool,
        efeito: tool.efeito,
        args: call.args,
        needsConfirm: true,
        status: "pending_confirm",
        idempotencyKey: actionId,
      });
      actions.push({ actionId, tool: call.tool, efeito: tool.efeito, status: "pending_confirm" });
    } else if (outcome.status === "done") {
      await db.insert(schema.assistantAction).values({
        id: actionId,
        agencyId,
        recruiterId,
        threadId,
        tool: call.tool,
        efeito: tool.efeito,
        args: call.args,
        needsConfirm: false,
        status: "done",
        resultRef: outcome.result.resultRef ?? null,
      });
      actions.push({
        actionId,
        tool: call.tool,
        efeito: tool.efeito,
        status: "done",
        summary: outcome.result.summary,
        ...(outcome.result.resultRef ? { resultRef: outcome.result.resultRef } : {}),
      });
    }
  }

  await db.insert(schema.assistantMessage).values({
    id: randomUUID(),
    threadId,
    agencyId,
    role: "assistant",
    content: plan.reply,
  });
  return { threadId, reply: plan.reply, actions };
}

/**
 * Confirma uma ação pendente (a Filipa aprovou). CAS no status (pending_confirm→done) → idempotente
 * e à prova de duplo-clique: a tool só corre depois de RECLAMAR a ação.
 */
export async function confirmAction(
  db: Db,
  agencyId: string,
  recruiterId: string,
  actionId: string,
): Promise<ActionView> {
  const [action] = await db
    .select({
      tool: schema.assistantAction.tool,
      efeito: schema.assistantAction.efeito,
      args: schema.assistantAction.args,
      status: schema.assistantAction.status,
      idempotencyKey: schema.assistantAction.idempotencyKey,
    })
    .from(schema.assistantAction)
    .where(
      and(
        eq(schema.assistantAction.id, actionId),
        eq(schema.assistantAction.agencyId, agencyId),
        eq(schema.assistantAction.recruiterId, recruiterId),
      ),
    );
  if (!action) {
    throw new Error("ação inexistente nesta agência");
  }
  if (action.status !== "pending_confirm") {
    return { actionId, tool: action.tool, efeito: action.efeito, status: action.status };
  }
  // CAS com TODAS as colunas de isolamento (atómico) → à prova de corrida/duplo-clique.
  const claimed = await db
    .update(schema.assistantAction)
    .set({ status: "done", confirmedBy: recruiterId })
    .where(
      and(
        eq(schema.assistantAction.id, actionId),
        eq(schema.assistantAction.agencyId, agencyId),
        eq(schema.assistantAction.recruiterId, recruiterId),
        eq(schema.assistantAction.status, "pending_confirm"),
      ),
    )
    .returning({ id: schema.assistantAction.id });
  if (claimed.length === 0) {
    return { actionId, tool: action.tool, efeito: action.efeito, status: "done" };
  }
  // Anti prompt-injection (defesa-em-profundidade): re-valida os `args` persistidos contra o
  // `argsSchema` da tool ANTES do executor real. Mesmo que algo tenha mudado entre planear e
  // confirmar (ou a allowlist tenha sido apertada), um destinatário fora da allowlist não executa.
  const recheck = validateToolArgs(action.tool, asArgs(action.args));
  if (recheck && !recheck.ok) {
    await db
      .update(schema.assistantAction)
      .set({ status: "failed" })
      .where(eq(schema.assistantAction.id, actionId));
    return { actionId, tool: action.tool, efeito: action.efeito, status: "failed" };
  }
  const outcome = executeToolCall(
    {
      tool: action.tool,
      args: asArgs(action.args),
      confirmed: true,
      idempotencyKey: action.idempotencyKey ?? undefined,
    },
    createMemoryStore(),
  );
  if (outcome.status === "failed" || outcome.status === "invalid_args") {
    // Executor falhou / args inválidos DEPOIS do claim → marca 'failed' (não fica preso em 'done').
    await db
      .update(schema.assistantAction)
      .set({ status: "failed" })
      .where(eq(schema.assistantAction.id, actionId));
    return { actionId, tool: action.tool, efeito: action.efeito, status: "failed" };
  }
  // Efeito real da tool `gravar` de memória: persiste mesmo o facto durável (isolado agency+recruiter).
  if (action.tool === "save_memory_fact") {
    const t = asArgs(action.args).text;
    try {
      await saveMemoryFact(db, agencyId, recruiterId, {
        text: typeof t === "string" ? t : "",
        sourceType: "explicit",
      });
    } catch {
      // Falhou a gravação (texto vazio/grande demais, DB) → marca 'failed' (a UI não finge sucesso).
      // TODO(FASE Ω): tornar o CAS+insert atómico (transação) quando o executor for real.
      await db
        .update(schema.assistantAction)
        .set({ status: "failed" })
        .where(eq(schema.assistantAction.id, actionId));
      return { actionId, tool: action.tool, efeito: action.efeito, status: "failed" };
    }
  }
  const summary = outcome.status === "done" ? outcome.result.summary : "executada";
  const resultRef = outcome.status === "done" ? outcome.result.resultRef : undefined;
  if (resultRef) {
    await db
      .update(schema.assistantAction)
      .set({ resultRef })
      .where(eq(schema.assistantAction.id, actionId));
  }
  return {
    actionId,
    tool: action.tool,
    efeito: action.efeito,
    status: "done",
    summary,
    ...(resultRef ? { resultRef } : {}),
  };
}
