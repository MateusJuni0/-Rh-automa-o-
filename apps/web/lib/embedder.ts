import { createOpenAiEmbedder, type Embedder, mockEmbedder } from "@rh/knowledge";

/** `true` quando há chave de embeddings — o RAG usa semântica real em vez do mock. */
export const EMBEDDER_ENABLED = Boolean(process.env.EMBEDDER_API_KEY);

/**
 * Embedder ativo (config-not-code): com `EMBEDDER_API_KEY` → adaptador REAL (OpenAI
 * text-embedding-3-small, dim 1536); sem chave → `mockEmbedder` determinístico (€0, prova a
 * canalização RAG store/query/cosine). A mesma interface nos dois → meter a chave basta. NUNCA
 * hardcodar chaves (`process.env`). Modelo opcional via `EMBEDDER_MODEL`.
 */
export function getEmbedder(): Embedder {
  const apiKey = process.env.EMBEDDER_API_KEY;
  if (apiKey) {
    return createOpenAiEmbedder({ apiKey, model: process.env.EMBEDDER_MODEL });
  }
  return mockEmbedder();
}
