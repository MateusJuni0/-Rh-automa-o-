import { type Embedder, mockEmbedder } from "@rh/knowledge";

/**
 * Embedder ativo. Sem chave de embeddings → `mockEmbedder` (determinístico, €0; prova a canalização
 * RAG store/query/cosine, sem semântica real). O embedder real (OpenAI text-embedding-3-small) liga-se
 * quando a chave chegar — ver KEYS-TODO.md. NUNCA hardcodar chaves.
 */
export function getEmbedder(): Embedder {
  // TODO(KEYS): if (process.env.EMBEDDER_API_KEY) return createOpenAiEmbedder({ apiKey }); — até lá, mock.
  return mockEmbedder();
}
