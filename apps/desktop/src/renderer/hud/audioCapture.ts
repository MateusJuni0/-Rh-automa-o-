/**
 * Captura de ÁUDIO no desktop (renderer) — scaffolding atrás de uma flag, com fallback no mock feed.
 * A captura REAL (microfone / áudio da call) usa `navigator.mediaDevices.getUserMedia` ou o
 * `desktopCapturer` do Electron; isso é wiring de browser, abstraído aqui atrás de `RawAudioStream`
 * (injetável) → testes sem hardware. Sem flag (ou sem permissão) → inativo, e o overlay continua a
 * usar o `mockFeed` (entrevista golden).
 *
 * ⚠️ Validação ponta-a-ponta precisa de HARDWARE (microfone/câmara) + as chaves (LiveKit/Soniox) —
 * é do Mateus. Aqui só ligamos a estrutura: abrir o stream → encaminhar bytes para o STT.
 */

/** Stream de áudio cru (injetável). Real = MediaRecorder/AudioWorklet sobre o MediaStream. */
export interface RawAudioStream {
  onAudio(cb: (bytes: Uint8Array) => void): void;
  stop(): void;
}

/** Alvo de áudio (a `SonioxTranscriptSource` do @rh/realtime satisfaz isto). */
export interface AudioSink {
  sendAudio(bytes: Uint8Array): void;
}

export interface AudioCaptureDeps {
  /** A captura está ligada? (flag + disponibilidade — ver `audioCaptureEnabled`). */
  enabled: boolean;
  /** Abre o stream de áudio cru (getUserMedia/desktopCapturer). Pode lançar (sem permissão). */
  openStream(): Promise<RawAudioStream>;
}

export interface CaptureStartResult {
  active: boolean;
  /** Motivo quando `active:false` (flag off, sem permissão, etc.) — nunca silenciar. */
  reason?: string;
}

export interface AudioCapture {
  start(): Promise<CaptureStartResult>;
  stop(): void;
  /** Encaminha o áudio capturado para um sink (ex.: o STT). */
  pipeTo(sink: AudioSink): void;
}

/**
 * Decide se a captura liga: SÓ com a flag explícita E `getUserMedia` disponível no runtime. (Default
 * off → o demo/dev usa o mock feed; um arranque sem permissão não tenta tocar no hardware.)
 */
export function audioCaptureEnabled(params: { flag: boolean; hasGetUserMedia: boolean }): boolean {
  return params.flag && params.hasGetUserMedia;
}

/** Cria a captura. NÃO abre o stream até `start()`. Se desligada, `start()` devolve inativo (mock feed). */
export function createAudioCapture(deps: AudioCaptureDeps): AudioCapture {
  const sinks = new Set<AudioSink>();
  let stream: RawAudioStream | undefined;

  return {
    async start() {
      if (!deps.enabled) {
        return { active: false, reason: "captura desligada (flag off) — a usar o mock feed" };
      }
      try {
        stream = await deps.openStream();
      } catch (error) {
        // Sem permissão / sem dispositivo → degrada para inativo (o overlay cai no mock feed).
        const reason = error instanceof Error ? error.message : "falha a abrir o áudio";
        return { active: false, reason };
      }
      stream.onAudio((bytes) => {
        for (const sink of sinks) {
          sink.sendAudio(bytes);
        }
      });
      return { active: true };
    },
    stop() {
      stream?.stop();
      stream = undefined;
    },
    pipeTo(sink) {
      sinks.add(sink);
    },
  };
}
