import type { Efeito } from "@rh/core";

/** Resultado MOCK de uma tool. `resultRef` = ponteiro para o artefacto (download/abrir). */
export interface ToolResult {
  summary: string;
  resultRef?: string;
}

export interface ToolDef {
  name: string;
  /** Efeito canónico (@rh/core): decide a porta de confirmação. rascunho/geração = `leitura`. */
  efeito: Efeito;
  /** Executor MOCK e PURO (não tem efeito real). O adapter real entra com a chave na FASE Ω. */
  run(args: Record<string, unknown>): ToolResult;
}

function tool(name: string, efeito: Efeito, summary: string, resultRef?: string): ToolDef {
  return {
    name,
    efeito,
    run: () => (resultRef !== undefined ? { summary, resultRef } : { summary }),
  };
}

/** Registo de ferramentas do assistente (AGENTE-TOOLS-E-WS). Todas MOCK no v1 (zero chaves). */
export const TOOLS: Record<string, ToolDef> = {
  // leitura / rascunho / geração → fluem livres
  search_knowledge: tool("search_knowledge", "leitura", "Encontrei factos relevantes (mock)."),
  comparar_candidatos: tool(
    "comparar_candidatos",
    "leitura",
    "Matriz de comparação pronta (mock).",
  ),
  ler_agenda: tool("ler_agenda", "leitura", "3 eventos hoje (mock)."),
  pesquisa_web: tool("pesquisa_web", "leitura", "Pesquisa web concluída (mock)."),
  gen_spreadsheet: tool(
    "gen_spreadsheet",
    "leitura",
    "Planilha gerada (mock).",
    "mock://comparacao.xlsx",
  ),
  gerar_cv: tool("gerar_cv", "leitura", "CV reformatado (mock).", "mock://cv.pdf"),
  rascunhar_email: tool(
    "rascunhar_email",
    "leitura",
    "Rascunho de email pronto (mock).",
    "mock://rascunho.txt",
  ),
  // gravar (durável) → confirmação
  save_artifact: tool("save_artifact", "gravar", "Artefacto guardado (mock).", "mock://saved"),
  save_memory_fact: tool("save_memory_fact", "gravar", "Facto guardado na memória (mock)."),
  // sourcing cria registo durável (async_job/process) — grava, não é só pesquisa.
  sourcing: tool(
    "sourcing",
    "gravar",
    "Sourcing iniciado — 3 perfis (mock).",
    "mock://sourcing-job",
  ),
  // enviar_fora (irreversível) → confirmação
  enviar_email: tool("enviar_email", "enviar_fora", "Email enviado (mock).", "mock://msg-id"),
  marcar_agenda: tool("marcar_agenda", "enviar_fora", "Evento marcado no calendário (mock)."),
  por_bot_na_call: tool("por_bot_na_call", "enviar_fora", "Bot colocado na call (mock)."),
};

export function getTool(name: string): ToolDef | undefined {
  return TOOLS[name];
}
