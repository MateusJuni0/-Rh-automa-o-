import { EMBEDDING_DIM } from "@rh/db";

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
