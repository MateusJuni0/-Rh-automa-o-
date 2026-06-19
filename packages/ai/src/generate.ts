import type { z } from "zod";
import type { Slot } from "./registry";
import { type RunSlotOptions, runSlot } from "./runner";

/** Prompt de uma geração: system (instrução fixa, cacheável) + user (dados do pedido). */
export interface GeneratePrompt {
  system: string;
  user: string;
}

/** O LLM devolveu algo que não valida contra o schema, mesmo após retry. */
export class GenerateParseError extends Error {
  readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "GenerateParseError";
    this.raw = raw;
  }
}

/** Extrai o objeto JSON do texto (tolera ```json … ``` à volta). */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Chama um slot e devolve o output VALIDADO contra um schema Zod. O modelo é instruído a devolver
 * JSON (`json:true`); se o parse/validação falhar, faz **1 retry** com o erro realimentado. Reusa
 * `runSlot` → herda o gate ZDR + fallback por slot. É a base de TODAS as features de IA.
 */
export async function generate<T extends z.ZodType>(
  slot: Slot,
  prompt: GeneratePrompt,
  schema: T,
  opts: RunSlotOptions,
): Promise<z.infer<T>> {
  const messages = [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];

  const first = await runSlot(slot, { messages, json: true }, opts);
  const firstParsed = schema.safeParse(extractJson(first.content));
  if (firstParsed.success) {
    return firstParsed.data;
  }

  const retry = await runSlot(
    slot,
    {
      messages: [
        ...messages,
        { role: "assistant", content: first.content },
        {
          role: "user",
          content: `O JSON anterior é inválido (${firstParsed.error.message}). Devolve APENAS JSON válido, sem texto à volta.`,
        },
      ],
      json: true,
    },
    opts,
  );
  const retryParsed = schema.safeParse(extractJson(retry.content));
  if (retryParsed.success) {
    return retryParsed.data;
  }
  throw new GenerateParseError(
    `output do slot ${slot} inválido após retry: ${retryParsed.error.message}`,
    retry.content,
  );
}
