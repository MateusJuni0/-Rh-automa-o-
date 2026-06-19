import type { Efeito } from "@rh/core";
import { getTool, type ToolResult } from "./tools";

/**
 * Porta de confirmação (ASSISTENTE-PESSOAL §2.1): `gravar`/`enviar_fora` pedem OK da Filipa;
 * `leitura` (inclui rascunho/geração) flui livre. Determinístico: `needs_confirm = efeito ∈ {gravar, enviar_fora}`.
 */
export function requiresConfirmation(efeito: Efeito): boolean {
  return efeito === "gravar" || efeito === "enviar_fora";
}

/** Loja de idempotência (anti duplo-envio §16I). A app liga-a à DB; testes usam um Set em memória. */
export interface IdempotencyStore {
  has(key: string): boolean;
  add(key: string): void;
}

export function createMemoryStore(): IdempotencyStore {
  const seen = new Set<string>();
  return { has: (k) => seen.has(k), add: (k) => void seen.add(k) };
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  /**
   * A Filipa aprovou esta ação (passou pela porta). ⚠️ SEGURANÇA: SÓ a camada de
   * route/UI pode pôr isto `true`, depois de uma ação EXPLÍCITA da utilizadora — NUNCA
   * a partir do JSON de tool-call do modelo (senão a porta de confirmação é contornada).
   */
  confirmed?: boolean;
  /** Chave de idempotência (anti-duplo) p/ `gravar`/`enviar_fora`. */
  idempotencyKey?: string;
}

export type ExecuteOutcome =
  | { status: "unknown_tool"; tool: string }
  | { status: "needs_confirm"; tool: string; efeito: Efeito }
  | { status: "duplicate"; tool: string; key: string }
  | { status: "failed"; tool: string; error: unknown }
  | { status: "done"; tool: string; efeito: Efeito; result: ToolResult };

/**
 * Executa uma tool-call respeitando a porta de confirmação + idempotência:
 * - tool desconhecida → `unknown_tool` (nunca executa o que não conhece);
 * - `gravar`/`enviar_fora` sem `confirmed` → `needs_confirm` (NÃO executa);
 * - `gravar`/`enviar_fora` com `idempotencyKey` já visto → `duplicate` (anti duplo §16I);
 * - executor que lança → `failed` (a chave NÃO é queimada → o retry é possível);
 * - caso contrário → corre o executor MOCK e devolve o resultado.
 * NOTA: a `confirmed` é confiada à camada de route/UI (ver ⚠️ em `ToolCall`).
 */
export function executeToolCall(call: ToolCall, store: IdempotencyStore): ExecuteOutcome {
  const tool = getTool(call.tool);
  if (!tool) {
    return { status: "unknown_tool", tool: call.tool };
  }
  if (requiresConfirmation(tool.efeito) && !call.confirmed) {
    return { status: "needs_confirm", tool: tool.name, efeito: tool.efeito };
  }
  // Idempotência só para os efeitos duráveis/irreversíveis (gravar + enviar_fora).
  const idemKey = requiresConfirmation(tool.efeito) ? call.idempotencyKey : undefined;
  if (idemKey !== undefined && store.has(idemKey)) {
    return { status: "duplicate", tool: tool.name, key: idemKey };
  }
  let result: ToolResult;
  try {
    result = tool.run(call.args);
  } catch (error) {
    // Falhou → NÃO marca a chave (evita "queimar" um envio que nunca aconteceu).
    return { status: "failed", tool: tool.name, error };
  }
  if (idemKey !== undefined) {
    store.add(idemKey); // só após o efeito ter ocorrido
  }
  return { status: "done", tool: tool.name, efeito: tool.efeito, result };
}
