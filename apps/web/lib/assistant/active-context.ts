import { z } from "zod";

/**
 * Contexto ativo do assistente (ASSISTENTE-PESSOAL §"dia caótico"): a(s) entidade(s) em FOCO da
 * thread. Cada turno atualiza-o (a Filipa diz "o Rui" → foca o Rui) e os turnos seguintes herdam-no
 * até mudar — evita pedir o alvo a cada frase E evita colar tudo ao primeiro candidato.
 *
 * Chaves em snake_case de propósito: é o shape gravado no JSONB `assistant_thread.active_context`
 * e o RGPD já filtra por `active_context->>'candidate_id'` (lib/rgpd.ts). Mudar para camelCase
 * partiria a purga. v1 resolve candidato + cliente (entidades nomeadas); job/process ficam para Ω.
 */
export interface ActiveContext {
  client_id?: string;
  job_id?: string;
  candidate_id?: string;
  process_id?: string;
}

const activeContextSchema = z.object({
  client_id: z.string().optional(),
  job_id: z.string().optional(),
  candidate_id: z.string().optional(),
  process_id: z.string().optional(),
});

/** Valida o JSONB na fronteira; cai para `{}` se o shape não bater (nunca confia no que está na DB). */
export function parseActiveContext(raw: unknown): ActiveContext {
  const parsed = activeContextSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export interface EntityRef {
  id: string;
  name: string;
}

export interface KnownEntities {
  candidates: readonly EntityRef[];
  clients: readonly EntityRef[];
}

/** Normaliza (sem acentos, minúsculas) para casar nomes tolerante a acentos/maiúsculas. */
function norm(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Tokens-palavra (≥1 letra) de um texto normalizado — para casar por palavra, não por substring. */
function wordSet(text: string): Set<string> {
  return new Set(
    norm(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
}

/**
 * Resolve qual entidade dada uma menção: nome COMPLETO presente (todos os tokens) ganha; senão,
 * primeiro nome ÚNICO (≥3 letras). Ambíguo (2+) ou nenhum → `null` (NÃO adivinha — não cola ao 1.º).
 */
function resolveOne(message: string, entities: readonly EntityRef[]): string | null {
  const words = wordSet(message);
  const fulls: string[] = [];
  const firsts: string[] = [];
  for (const e of entities) {
    const tokens = norm(e.name).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      continue;
    }
    if (tokens.every((t) => words.has(t))) {
      fulls.push(e.id);
    }
    const first = tokens[0] ?? "";
    if (first.length >= 3 && words.has(first)) {
      firsts.push(e.id);
    }
  }
  if (fulls.length === 1) {
    return fulls[0] ?? null;
  }
  if (fulls.length === 0 && firsts.length === 1) {
    return firsts[0] ?? null;
  }
  return null; // ambíguo ou sem menção → não foca
}

/**
 * Próxima janela de foco: menção a candidato/cliente foca-o (por dimensão, independentes); sem
 * menção numa dimensão, herda a anterior. Puro e imutável — devolve o MESMO `prev` se nada mudou
 * (o caller usa a identidade para evitar gravar à toa).
 */
export function resolveActiveContext(
  prev: ActiveContext,
  message: string,
  known: KnownEntities,
): ActiveContext {
  const candidate = resolveOne(message, known.candidates);
  const client = resolveOne(message, known.clients);
  const nextCandidate = candidate ?? prev.candidate_id;
  const nextClient = client ?? prev.client_id;
  if (nextCandidate === prev.candidate_id && nextClient === prev.client_id) {
    return prev;
  }
  return {
    ...prev,
    ...(nextCandidate ? { candidate_id: nextCandidate } : {}),
    ...(nextClient ? { client_id: nextClient } : {}),
  };
}

/** Deriva os nomes em foco para o `ChatContext` do planner (candidato + cliente). */
export function contextNames(
  ctx: ActiveContext,
  known: KnownEntities,
): { candidatos?: string[]; clienteNome?: string } {
  const out: { candidatos?: string[]; clienteNome?: string } = {};
  if (ctx.candidate_id) {
    const c = known.candidates.find((e) => e.id === ctx.candidate_id);
    if (c) {
      out.candidatos = [c.name];
    }
  }
  if (ctx.client_id) {
    const c = known.clients.find((e) => e.id === ctx.client_id);
    if (c) {
      out.clienteNome = c.name;
    }
  }
  return out;
}
