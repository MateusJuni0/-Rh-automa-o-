import {
  type ClientMessage,
  clientMessage,
  type ServerMessage,
  serverMessage,
  WS_PROTOCOL_VERSION,
} from "@rh/core";

/** Omit distributivo sobre o union de frames (preserva os campos de cada variante). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Payload de um frame de servidor SEM o envelope (`v`/`seq`) — o codec injeta-os. */
export type ServerFramePayload = DistributiveOmit<ServerMessage, "v" | "seq">;

/** Contador de `seq` monótono por ligação (começa em 0; cliente usa-o no replay/ack). */
export class SeqCounter {
  #seq = -1;
  next(): number {
    this.#seq += 1;
    return this.#seq;
  }
  get current(): number {
    return this.#seq;
  }
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Parse + validação de uma mensagem do cliente (string JSON ou objeto já desserializado). */
export function parseClientMessage(raw: unknown): ParseResult<ClientMessage> {
  let json: unknown = raw;
  if (typeof raw === "string") {
    try {
      json = JSON.parse(raw);
    } catch {
      return { ok: false, error: "json inválido" };
    }
  }
  const parsed = clientMessage.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "frame de cliente inválido" };
  }
  return { ok: true, value: parsed.data };
}

/** Constrói um frame de servidor injetando `v` (versão) + `seq`; valida contra o contrato. */
export function buildServerFrame(payload: ServerFramePayload, seq: number): ServerMessage {
  return serverMessage.parse({ ...payload, v: WS_PROTOCOL_VERSION, seq });
}

/** Sessão de frames de uma ligação: prende um `SeqCounter` ao builder (fiabilidade seq/ack). */
export class FrameSession {
  readonly #seq = new SeqCounter();
  build(payload: ServerFramePayload): ServerMessage {
    return buildServerFrame(payload, this.#seq.next());
  }
  get lastSeq(): number {
    return this.#seq.current;
  }
}
