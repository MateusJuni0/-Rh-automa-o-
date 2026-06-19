import { type EstadoVivo, estadoVivo, type Suggestion, suggestion } from "@rh/core";
import { z } from "zod";
import { generate } from "../generate";
import type { RunSlotOptions } from "../runner";

/** Feature AO VIVO do cérebro (slot LIVE — latência manda). */

export interface TickInput {
  /** Requisitos da rubric com os ids canónicos — o tick keia a cobertura por estes (§16F). */
  requisitos: Array<{ requisitoId: string; display: string }>;
  interessesCliente: Array<{ tema: string }>;
  /** Janela recente de transcrição (não as 2h — custo constante). */
  janela: string;
  estadoAnterior?: EstadoVivo;
}

export interface TickOutput {
  estado: EstadoVivo;
  suggestion: Suggestion | null;
}

const tickSchema = z.object({ estado: estadoVivo, suggestion: suggestion.nullable() });

const TICK_SYSTEM = [
  "Atualiza o ESTADO VIVO da entrevista a partir da janela recente de transcrição.",
  "Estados canónicos de cada requisito: 'não-tocado'|'raso'|'coberto-com-prova'|'contradito'.",
  "Usa SÓ os requisitoId DADOS no input (não inventes ids). Propõe a próxima sugestão por lente (tecnica|cliente|gap).",
  'Devolve APENAS JSON: { "estado": { requisitos:[{requisitoId,display,status,confianca?,evidencia?}], interessesCliente:[...], afirmacoesCandidato:[...], perguntasFeitas:[], redFlags:[], resumoCorrente:"" }, "suggestion": { pergunta, lente, requisitoId } | null }.',
].join("\n");

/**
 * Corre um tick (P2.3): estado vivo + próxima sugestão. **Fail-safe §16F:** descarta qualquer
 * requisito cujo `requisitoId` não esteja no conjunto dado, e anula o `requisitoId` da sugestão
 * se for desconhecido — o frame nunca referencia ids fora da rubric.
 */
export async function runTick(input: TickInput, opts: RunSlotOptions): Promise<TickOutput> {
  const allowed = new Set(input.requisitos.map((r) => r.requisitoId));
  const out = await generate(
    "LIVE",
    { system: TICK_SYSTEM, user: JSON.stringify(input) },
    tickSchema,
    opts,
  );

  const estado: EstadoVivo = {
    ...out.estado,
    requisitos: out.estado.requisitos.filter((r) => allowed.has(r.requisitoId)),
  };
  const s = out.suggestion;
  const sug: Suggestion | null =
    s === null
      ? null
      : {
          ...s,
          requisitoId: s.requisitoId !== null && allowed.has(s.requisitoId) ? s.requisitoId : null,
        };

  return { estado, suggestion: sug };
}
