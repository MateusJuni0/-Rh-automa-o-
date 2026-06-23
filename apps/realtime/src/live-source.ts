/**
 * Compositor da fonte AO VIVO (config-not-code). Liga as peças reais numa única `TranscriptSource`:
 *
 *   LiveKit (transporte de áudio: o bot entra na sala) ──audio──▶ Soniox (STT + diarização) ──chunks──▶
 *
 * O resultado é uma `TranscriptSource` IGUAL à do mock → o resto do pipeline (`TickEngine.attach` →
 * frames WS → overlay) não muda. Só a FONTE troca. Transportes INJETADOS (sem rede nos testes);
 * inerte sem chave — a app só chama isto quando `chooseTranscriptMode() === "live"`.
 *
 * ⚠️ A validação ponta-a-ponta (entrar numa sala real + áudio → transcrição) é do Mateus, com as
 * chaves + servidor LiveKit + hardware. Aqui provamos só que as peças COMPÕEM (teste com fakes).
 */

import {
  createLiveKitAudioBot,
  type LiveKitOptions,
  type LiveKitRoomFactory,
  type LiveKitTokenFactory,
} from "./livekit";
import { createSonioxSource, type SonioxOptions, type SonioxSocketFactory } from "./soniox";
import type { TranscriptSource } from "./source";

export interface LiveSourceOptions {
  soniox: SonioxOptions;
  livekit: LiveKitOptions;
}

/** Fábricas dos transportes (injetadas): a app passa os SDKs reais; os testes passam fakes. */
export interface LiveSourceFactories {
  socketFactory: SonioxSocketFactory;
  roomFactory: LiveKitRoomFactory;
  tokenFactory: LiveKitTokenFactory;
}

export interface LiveTranscriptSource {
  /** A fonte para dar ao `TickEngine.attach` (idêntica à do mock). */
  source: TranscriptSource;
  /** Liga o bot (entra na sala) → o áudio começa a fluir para o STT. */
  start(): Promise<void>;
  /** Desliga o bot e fecha o STT. */
  stop(): void;
}

/**
 * Compõe a fonte ao vivo: cria o STT Soniox, cria o bot LiveKit e encaminha TODO o áudio da sala
 * para o STT (`pipeToSoniox`). `start()` entra na sala; `stop()` desliga ambos.
 */
export function buildLiveTranscriptSource(
  opts: LiveSourceOptions,
  factories: LiveSourceFactories,
): LiveTranscriptSource {
  const stt = createSonioxSource(opts.soniox, factories.socketFactory);
  const bot = createLiveKitAudioBot(opts.livekit, factories.roomFactory, factories.tokenFactory);
  bot.pipeToSoniox(stt);
  return {
    source: stt,
    start: () => bot.start(),
    stop: () => {
      bot.stop();
      stt.close();
    },
  };
}
