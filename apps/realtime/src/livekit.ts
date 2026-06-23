/**
 * Adapter de transporte de ÁUDIO REAL — LiveKit. O "bot" da Vera entra na sala da entrevista e
 * recebe o áudio dos participantes (candidato), que depois alimenta o STT (Soniox). Inerte sem
 * `LIVEKIT_*` (config-not-code). A `Room` e o gerador de token são INJETADOS → testes sem rede.
 *
 * ⚠️ Validação ponta-a-ponta (entrar numa sala real, receber áudio) é do Mateus, com as chaves +
 * o servidor LiveKit. Aqui ligamos só o fluxo: conectar → receber frames → encaminhar. NUNCA
 * conectar a um servidor real nos testes.
 */

import { logTransportError } from "./log";

/** `true` quando há config LiveKit completa (URL + key + secret). */
export function LIVEKIT_ENABLED(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET,
  );
}

/** Abstração mínima de uma Room do LiveKit (injetável). A app passa o SDK real; testes um fake. */
export interface LiveKitRoom {
  /** `audioFrame` (participant, bytes) é o evento que normalizamos a partir das tracks subscritas. */
  on(event: "audioFrame" | "disconnected", cb: (...args: unknown[]) => void): void;
  connect(url: string, token: string): Promise<void>;
  disconnect(): void;
}

export type LiveKitRoomFactory = () => LiveKitRoom;

/** Gera o access token (JWT LiveKit) a partir da identidade/sala. Real = `AccessToken` do SDK. */
export type LiveKitTokenFactory = (params: {
  apiKey: string;
  apiSecret: string;
  room: string;
  identity: string;
}) => string;

export interface LiveKitOptions {
  url: string;
  apiKey: string;
  apiSecret: string;
  room: string;
  identity: string;
  /** Desconexão/erro da sala — fail-loud. Default: stderr (ver `logTransportError`). O orquestrador
   * pode passar o seu (ex.: cair para o mock feed quando a call cai a meio da entrevista). */
  onError?: (err: unknown) => void;
}

/** Recebe `(participantId, bytes)` para cada bloco de áudio de um participante. */
export type AudioHandler = (participant: string, bytes: Uint8Array) => void;

/** Alvo mínimo de "para onde enviar o áudio" — a `SonioxTranscriptSource` satisfaz isto. */
export interface AudioSink {
  sendAudio(bytes: Uint8Array): void;
}

export interface LiveKitAudioBot {
  start(): Promise<void>;
  stop(): void;
  /** Subscreve às frames de áudio (cru). */
  onAudio(handler: AudioHandler): void;
  /** Atalho: encaminha TODO o áudio recebido para um STT (ex.: createSonioxSource). */
  pipeToSoniox(sink: AudioSink): void;
}

/**
 * Cria o bot de áudio. NÃO conecta já — `start()` gera o token e conecta. As frames de áudio dos
 * participantes são entregues aos handlers `onAudio`/`pipeToSoniox`. `stop()` desliga.
 */
export function createLiveKitAudioBot(
  opts: LiveKitOptions,
  factory: LiveKitRoomFactory,
  tokenFactory: LiveKitTokenFactory,
): LiveKitAudioBot {
  const room = factory();
  const handlers = new Set<AudioHandler>();
  const onError = opts.onError ?? ((e: unknown) => logTransportError("livekit", e));

  room.on("audioFrame", (...args: unknown[]) => {
    const participant = String(args[0] ?? "");
    // `args[1]` é input não-confiável do transporte → fica `unknown` até o `instanceof` o estreitar
    // (sem `as` cego: se o guard for removido no futuro, vira erro de compilação, não bug silencioso).
    const raw: unknown = args[1];
    if (!(raw instanceof Uint8Array)) {
      return;
    }
    for (const h of handlers) {
      h(participant, raw);
    }
  });

  // Fail-loud: a sala desligar a meio (rede, restart, token expirado) NÃO fica silencioso — senão o
  // bot pára de entregar áudio e o HUD/TickEngine emudecem sem qualquer sinal de que a fonte morreu.
  room.on("disconnected", () => onError(new Error("desligado da sala")));

  return {
    async start() {
      const token = tokenFactory({
        apiKey: opts.apiKey,
        apiSecret: opts.apiSecret,
        room: opts.room,
        identity: opts.identity,
      });
      await room.connect(opts.url, token);
    },
    stop() {
      room.disconnect();
    },
    onAudio(handler) {
      handlers.add(handler);
    },
    pipeToSoniox(sink) {
      handlers.add((_participant, bytes) => sink.sendAudio(bytes));
    },
  };
}
