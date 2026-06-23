import { EMBEDDING_DIM } from "@rh/db";
import { z } from "zod";

/** Embedder — texto → vetor (dim do EMBEDDER = 1536). Real = OpenAI text-embedding-3-small; aqui mock. */
export interface Embedder {
  embed(texts: readonly string[]): Promise<number[][]>;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Embedder MOCK determinístico (SEM chave): mesmo texto → mesmo vetor (dim 1536), normalizado (L2=1).
 * NÃO tem semântica real — serve para provar a canalização RAG (store/query/cosine). Troca-se pelo
 * embedder real quando a chave chegar (KEYS-TODO.md). LCG semeado pelo hash do texto → determinismo.
 */
export function mockEmbedder(): Embedder {
  return {
    embed(texts) {
      return Promise.resolve(
        texts.map((t) => {
          let x = hashString(t) || 1;
          const v: number[] = new Array(EMBEDDING_DIM);
          for (let i = 0; i < EMBEDDING_DIM; i++) {
            x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
            v[i] = (x / 0xffffffff) * 2 - 1;
          }
          let norm = 0;
          for (const c of v) {
            norm += c * c;
          }
          norm = Math.sqrt(norm) || 1;
          return v.map((c) => c / norm);
        }),
      );
    },
  };
}

/** Forma mínima da resposta de embeddings (OpenAI). */
const embeddingsResponse = z.object({
  data: z.array(z.object({ index: z.number().int(), embedding: z.array(z.number()) })).min(1),
});

export interface OpenAiEmbedderOptions {
  /** Chave do embedder — vem de `process.env.EMBEDDER_API_KEY` no app (NUNCA hardcoded). */
  apiKey: string;
  model?: string;
  baseUrl?: string;
  /** Injetável para testes (default = `fetch` global). */
  fetchImpl?: typeof fetch;
}

/**
 * Embedder REAL (OpenAI text-embedding-3-small, dim 1536). INERTE até à chave — o app só o usa
 * quando `EMBEDDER_API_KEY` existe (config-not-code; ver `getEmbedder`). Mesma assinatura do mock,
 * por isso troca-se sem reescrever a canalização RAG. `fetchImpl` injetável p/ testes.
 */
export function createOpenAiEmbedder(opts: OpenAiEmbedderOptions): Embedder {
  if (!opts.apiKey) {
    throw new Error("EMBEDDER_API_KEY em falta");
  }
  const model = opts.model ?? "text-embedding-3-small";
  const baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    async embed(texts) {
      if (texts.length === 0) {
        return [];
      }
      const res = await doFetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({ model, input: texts }),
      });
      if (!res.ok) {
        throw new Error(`embedder OpenAI: HTTP ${res.status}`);
      }
      const parsed = embeddingsResponse.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error("embedder OpenAI: resposta em formato inesperado");
      }
      // A OpenAI devolve por `index` — ordenar p/ garantir a ordem dos inputs.
      const ordered = [...parsed.data.data].sort((a, b) => a.index - b.index);
      if (ordered.length !== texts.length) {
        throw new Error("embedder OpenAI: nº de vetores ≠ nº de textos");
      }
      for (const d of ordered) {
        if (d.embedding.length !== EMBEDDING_DIM) {
          throw new Error(`embedder OpenAI: dim ${d.embedding.length} ≠ ${EMBEDDING_DIM}`);
        }
      }
      return ordered.map((d) => d.embedding);
    },
  };
}
