/**
 * Planner MOCK do assistente (ASSISTENTE-CONVERSA). Deteção de intenção por palavras-chave —
 * SEM LLM. Determinístico, puro, testável. O motor ReAct real (lince-brain-local + chave) = FASE Ω.
 */

export interface ChatContext {
  /** Nomes/ids de candidatos no contexto ativo (p/ comparar/Q&A). */
  candidatos?: string[];
  clienteNome?: string;
}

export interface PlannedToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface ChatPlan {
  reply: string;
  toolCalls: PlannedToolCall[];
}

interface Intent {
  test: RegExp;
  tool: string;
  reply: string;
}

// Ordem = prioridade (o 1.º match ganha). enviar_email/sourcing/marcar_agenda têm efeito que pede confirmação.
const INTENTS: ReadonlyArray<Intent> = [
  { test: /compar/, tool: "comparar_candidatos", reply: "Preparei a comparação dos candidatos." },
  {
    test: /(envi|mand).*(email|e-mail|mensagem|cliente)/,
    tool: "enviar_email",
    reply: "Vou enviar este email ao cliente.",
  },
  {
    test: /(rascun|redig|escrev).*(email|e-mail|mensagem|feedback)/,
    tool: "rascunhar_email",
    reply: "Rascunhei o email na tua voz.",
  },
  {
    test: /(planilha|xlsx|excel|folha de c)/,
    tool: "gen_spreadsheet",
    reply: "Gerei a planilha.",
  },
  {
    test: /(sourcing|prospec|procurar perfis|encontrar candidatos)/,
    tool: "sourcing",
    reply: "Vou iniciar o sourcing.",
  },
  {
    test: /(marcar|agendar).*(reuni|entrevista|call)/,
    tool: "marcar_agenda",
    reply: "Vou marcar no calendário.",
  },
  { test: /(agenda|calend)/, tool: "ler_agenda", reply: "Aqui está a tua agenda." },
];

function qaReply(message: string, ctx: ChatContext): string {
  const sobre = ctx.candidatos?.length
    ? ` sobre ${ctx.candidatos.join(", ")}`
    : ctx.clienteNome
      ? ` sobre ${ctx.clienteNome}`
      : "";
  return `Pela transcrição e factos${sobre}: (mock — sem chave para a resposta completa). Pergunta: "${message.trim()}".`;
}

/** Plano de resposta para uma mensagem. Devolve a resposta + tool-calls a executar (pela porta). */
export function planResponse(message: string, ctx: ChatContext = {}): ChatPlan {
  const m = message.toLowerCase();
  for (const intent of INTENTS) {
    if (intent.test.test(m)) {
      return { reply: intent.reply, toolCalls: [{ tool: intent.tool, args: { message } }] };
    }
  }
  return { reply: qaReply(message, ctx), toolCalls: [] };
}
