import { z } from "zod";
import { type LlmRequest, type LlmResponse, type LlmTransport, LlmTransportError } from "./runner";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/** Forma mínima da resposta de chat-completions (OpenRouter/OpenAI-compatível). */
const completionResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export interface OpenRouterOptions {
  /** Chave do OpenRouter — vem de `process.env.OPENROUTER_API_KEY` no app (NUNCA hardcoded). */
  apiKey: string;
  baseUrl?: string;
  /** Injetável para testes (default = `fetch` global). */
  fetchImpl?: typeof fetch;
}

/**
 * Transporte OpenRouter (v1 = só OpenRouter para os slots de chat — MODELOS-E-API §4).
 * Mapeia o status HTTP para o tipo de falha que o `runSlot` entende: 429/5xx/rede → `transient`
 * (vale descer na lista do slot, §5); 4xx (≠429) → `permanent` (propaga).
 */
export function createOpenRouterTransport(opts: OpenRouterOptions): LlmTransport {
  if (!opts.apiKey) {
    throw new Error("OPENROUTER_API_KEY em falta");
  }
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    async complete(modelId: string, req: LlmRequest): Promise<LlmResponse> {
      let res: Response;
      try {
        res = await doFetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${opts.apiKey}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: req.messages,
            ...(req.json ? { response_format: { type: "json_object" } } : {}),
          }),
        });
      } catch (e) {
        throw new LlmTransportError("transient", `falha de rede: ${String(e)}`);
      }

      if (!res.ok) {
        const kind = res.status === 429 || res.status >= 500 ? "transient" : "permanent";
        throw new LlmTransportError(kind, `openrouter ${res.status}`, res.status);
      }

      const parsed = completionResponse.safeParse(await res.json());
      if (!parsed.success) {
        throw new LlmTransportError("permanent", "resposta do openrouter em formato inesperado");
      }
      const [first] = parsed.data.choices;
      if (!first) {
        throw new LlmTransportError("permanent", "resposta do openrouter sem choices");
      }
      return { modelId, content: first.message.content };
    },
  };
}
