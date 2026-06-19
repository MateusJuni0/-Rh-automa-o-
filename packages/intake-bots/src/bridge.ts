import type { IntakeBotMessage, MessageSource } from "./source";

/**
 * Liga uma `MessageSource` ao handler de ingestão (que a app implementa com `ingerirMensagem`).
 * Fire-and-forget por mensagem; devolve a função de cancelamento. Não conhece a DB nem chaves.
 */
export function runIntakeBridge(
  source: MessageSource,
  onMessage: (m: IntakeBotMessage) => void | Promise<void>,
): () => void {
  return source.subscribe((m) => {
    void onMessage(m);
  });
}
