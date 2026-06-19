/** Uma mensagem encaminhada para ingestão (Telegram/WhatsApp/web/email). */
export interface IntakeBotMessage {
  source: string; // telegram|whatsapp|web_upload|email
  externalId: string; // id externo do chat/mensagem (dedup/auditoria)
  text: string;
}

/** Fonte de mensagens de ingestão. Real = Telegram (token) / WhatsApp (Evolution) — chave. */
export interface MessageSource {
  /** Subscreve às mensagens; devolve uma função de cancelamento. */
  subscribe(onMsg: (m: IntakeBotMessage) => void): () => void;
}

/**
 * Fonte MANUAL (dev/testes): `push` emite uma mensagem aos subscritores. Substitui-se pelos adapters
 * Telegram/WhatsApp quando a chave chegar (KEYS-TODO.md) — inerte até lá. Padrão = `@rh/realtime`.
 */
export function createManualMessageSource(): {
  source: MessageSource;
  push: (m: IntakeBotMessage) => void;
} {
  const listeners = new Set<(m: IntakeBotMessage) => void>();
  const source: MessageSource = {
    subscribe(onMsg) {
      listeners.add(onMsg);
      return () => {
        listeners.delete(onMsg);
      };
    },
  };
  return {
    source,
    push: (m) => {
      for (const l of listeners) {
        l(m);
      }
    },
  };
}
