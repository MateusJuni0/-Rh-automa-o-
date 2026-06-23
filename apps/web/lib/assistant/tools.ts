import type { Efeito } from "@rh/core";
import { z } from "zod";

/** Resultado MOCK de uma tool. `resultRef` = ponteiro para o artefacto (download/abrir). */
export interface ToolResult {
  summary: string;
  resultRef?: string;
}

export interface ToolDef {
  name: string;
  /** Efeito canónico (@rh/core): decide a porta de confirmação. rascunho/geração = `leitura`. */
  efeito: Efeito;
  /**
   * Schema dos `args` que a tool aceita (anti prompt-injection: o LLM produz os args, NÃO confiamos
   * neles). Valida-se ao planear (tool-call inválida é descartada) e antes de executar (gate). Os
   * schemas de leitura são tolerantes (aceitam extras); os de `enviar_fora` são estritos.
   */
  argsSchema: z.ZodType;
  /** Executor MOCK e PURO (não tem efeito real). O adapter real entra com a chave na FASE Ω. */
  run(args: Record<string, unknown>): ToolResult;
}

/**
 * Allowlist de domínios de destinatário para os efeitos `enviar_fora` (email). Server-side: mesmo
 * que o LLM (ou um prompt-injection no CV) peça para enviar para um domínio arbitrário, só estes
 * passam. Em produção isto vem de config por agência; no v1 (IRIS) é a allowlist abaixo + os
 * domínios dos próprios recrutadores. NUNCA permitir wildcard.
 */
export const EMAIL_DOMAIN_ALLOWLIST: readonly string[] = ["iris.tech"];

/** Valida um email e o seu domínio contra a allowlist (case-insensitive). */
export function isAllowedRecipient(email: string): boolean {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) {
    return false;
  }
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  return EMAIL_DOMAIN_ALLOWLIST.includes(domain);
}

/** Schema de um destinatário de email na allowlist (refine server-side). */
const recipientSchema = z
  .string()
  .email()
  .refine(isAllowedRecipient, { message: "destinatário fora da allowlist" });

/** Schema tolerante p/ tools de leitura/rascunho: aceita qualquer objeto (incl. chaves extra). */
const looseArgs = z.record(z.string(), z.unknown());

function tool(
  name: string,
  efeito: Efeito,
  summary: string,
  opts?: { resultRef?: string; argsSchema?: z.ZodType },
): ToolDef {
  const resultRef = opts?.resultRef;
  return {
    name,
    efeito,
    argsSchema: opts?.argsSchema ?? looseArgs,
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
  gen_spreadsheet: tool("gen_spreadsheet", "leitura", "Planilha gerada (mock).", {
    resultRef: "mock://comparacao.xlsx",
  }),
  gerar_cv: tool("gerar_cv", "leitura", "CV reformatado (mock).", { resultRef: "mock://cv.pdf" }),
  rascunhar_email: tool("rascunhar_email", "leitura", "Rascunho de email pronto (mock).", {
    resultRef: "mock://rascunho.txt",
  }),
  // gravar (durável) → confirmação
  save_artifact: tool("save_artifact", "gravar", "Artefacto guardado (mock).", {
    resultRef: "mock://saved",
  }),
  save_memory_fact: tool("save_memory_fact", "gravar", "Facto guardado na memória (mock).", {
    // texto livre (memória). `text` é opcional aqui (a porta + `saveMemoryFact` no run.ts já tratam
    // texto vazio → failed); SE presente, limita o tamanho (anti payload gigante).
    argsSchema: z.object({ text: z.string().max(2000).optional() }).loose(),
  }),
  // sourcing cria registo durável (async_job/process) — grava, não é só pesquisa.
  sourcing: tool("sourcing", "gravar", "Sourcing iniciado — 3 perfis (mock).", {
    resultRef: "mock://sourcing-job",
  }),
  // enviar_fora (irreversível) → confirmação + args ESTRITOS (destinatário na allowlist).
  // `to` é OPCIONAL (o planner mock não o extrai; o adapter real exige-o na sua fronteira), MAS se
  // presente TEM de estar na allowlist server-side → um `to` envenenado (LLM/injeção no CV) é rejeitado.
  // ⚠️ Ω (adapter real): validar TAMBÉM cc/bcc contra a allowlist (o `.loose()` deixa-os passar aqui;
  // o mock não envia, mas o adapter real TEM de os filtrar — senão são vetor de exfiltração).
  enviar_email: tool("enviar_email", "enviar_fora", "Email enviado (mock).", {
    resultRef: "mock://msg-id",
    argsSchema: z
      .object({
        to: recipientSchema.optional(),
        subject: z.string().max(500).optional(),
        body: z.string().max(50_000).optional(),
      })
      .loose(),
  }),
  // campos opcionais/tolerantes (o planner mock passa `{message}`); o adapter real exige-os na sua
  // fronteira. SE presentes, valida-se o formato (limites de tamanho / UUID) — defesa básica.
  marcar_agenda: tool("marcar_agenda", "enviar_fora", "Evento marcado no calendário (mock).", {
    argsSchema: z
      .object({
        title: z.string().min(1).max(500).optional(),
        startsAt: z.string().min(1).max(40).optional(),
      })
      .loose(),
  }),
  por_bot_na_call: tool("por_bot_na_call", "enviar_fora", "Bot colocado na call (mock).", {
    argsSchema: z.object({ interviewId: z.uuid().optional() }).loose(),
  }),
};

export function getTool(name: string): ToolDef | undefined {
  return TOOLS[name];
}

/** Valida os `args` contra o schema da tool. `null` se a tool não existe. */
export function validateToolArgs(
  name: string,
  args: unknown,
): { ok: true; args: Record<string, unknown> } | { ok: false; reason: string } | null {
  const tool = getTool(name);
  if (!tool) {
    return null;
  }
  const parsed = tool.argsSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues[0]?.message ?? "args inválidos" };
  }
  return { ok: true, args: parsed.data as Record<string, unknown> };
}
