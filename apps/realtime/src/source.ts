/** Um trecho de transcrição diarizada (vem do STT ao vivo). */
export interface TranscriptChunk {
  speaker: "candidate" | "recruiter" | "client" | "other";
  text: string;
  ts: string; // "12:03"
}

/** Fonte de transcrição ao vivo. Real = LiveKit (áudio) + Soniox (STT+diarização) — chave. */
export interface TranscriptSource {
  /** Subscreve aos chunks; devolve uma função de cancelamento. */
  subscribe(onChunk: (chunk: TranscriptChunk) => void): () => void;
}

/**
 * Fonte MANUAL (dev/testes): `push` emite um chunk aos subscritores. Substitui-se pelo adapter
 * LiveKit+Soniox quando a chave chegar (KEYS-TODO.md). Diarização Soniox = trabalho NOVO (stub agora).
 */
export function createManualTranscriptSource(): {
  source: TranscriptSource;
  push: (chunk: TranscriptChunk) => void;
} {
  const listeners = new Set<(c: TranscriptChunk) => void>();
  const source: TranscriptSource = {
    subscribe(onChunk) {
      listeners.add(onChunk);
      return () => {
        listeners.delete(onChunk);
      };
    },
  };
  return {
    source,
    push: (chunk) => {
      for (const l of listeners) {
        l(chunk);
      }
    },
  };
}
