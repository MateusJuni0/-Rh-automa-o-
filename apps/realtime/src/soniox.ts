import { logTransportError } from "./log";
import type { TranscriptChunk, TranscriptSource } from "./source";

/**
 * Adapter STT REAL — Soniox streaming (WebSocket de transcrição ao vivo + diarização). Inerte sem
 * `SONIOX_API_KEY` (config-not-code: a app só o liga quando há chave; senão usa o mock manual). O
 * transporte WebSocket é INJETADO (`SonioxSocketFactory`) → testes sem rede, zero chamadas pagas.
 *
 * ⚠️ Validação ponta-a-ponta (áudio real → transcrição) é do Mateus, com a chave — aqui só ligamos
 * o protocolo (config inicial + parse de tokens). NUNCA abrir a ligação real nos testes.
 */

/** `true` quando há chave Soniox (a app decide ligar o adapter real vs. mock). */
export function SONIOX_ENABLED(): boolean {
  return Boolean(process.env.SONIOX_API_KEY);
}

/** Token de transcrição da Soniox (forma mínima que consumimos). */
export interface SonioxToken {
  text: string;
  /** Etiqueta de falante da diarização (string, ex.: "1", "2"). */
  speaker?: string;
  /** `true` = transcrição estável (final); `false` = parcial (ignoramos). */
  is_final?: boolean;
}

/** Abstração do WebSocket (injetável). A app passa um `ws`/WebSocket real; os testes passam um fake. */
export interface SonioxSocket {
  on(event: "open" | "message" | "close" | "error", cb: (arg?: unknown) => void): void;
  send(data: string): void;
  close(): void;
}

export type SonioxSocketFactory = (url: string) => SonioxSocket;

export interface SonioxOptions {
  apiKey: string;
  /** Modelo STT (default: tempo-real multilingue). */
  model?: string;
  /** Endpoint WS (default: o oficial da Soniox). Injetável p/ testes/staging. */
  url?: string;
  /** Falha do transporte (erro/close do WS) — fail-loud. Default: stderr (ver `logTransportError`). */
  onError?: (err: unknown) => void;
}

/** Fonte de transcrição Soniox + envio de áudio. Estende `TranscriptSource` com `sendAudio`/`close`. */
export interface SonioxTranscriptSource extends TranscriptSource {
  /** Encaminha um bloco de áudio (PCM/opus) para o STT. */
  sendAudio(bytes: Uint8Array): void;
  close(): void;
}

const DEFAULT_URL = "wss://stt-rt.soniox.com/transcribe-websocket";
const DEFAULT_MODEL = "stt-rt-preview";

/**
 * Mapeia a etiqueta de falante da Soniox → o papel do nosso domínio. v1 single-tenant (1 candidato +
 * 1 recrutador): speaker "1" = candidato, "2" = recrutador, restantes = "other". (Em produção isto
 * pode vir de calibração por voz; aqui é a convenção determinística.)
 */
function speakerToRole(speaker: string | undefined): TranscriptChunk["speaker"] {
  if (speaker === "1") {
    return "candidate";
  }
  if (speaker === "2") {
    return "recruiter";
  }
  return "other";
}

/**
 * Mapeia os tokens FINAIS de uma mensagem em `TranscriptChunk`s, AGRUPANDO por falante CONTÍGUO.
 * A Soniox pode emitir uma troca de falante a meio de uma mensagem; juntar tudo num só chunk
 * misturaria falas e atribuí-las-ia ao 1.º falante (atribuição errada → tick/transcrição corruptos).
 * Tokens parciais (`is_final:false`) são ignorados (só transcrição estável). Sem finais → `[]`.
 */
export function sonioxTokensToChunks(tokens: SonioxToken[], ts: string): TranscriptChunk[] {
  const finals = tokens.filter((t) => t.is_final);
  if (finals.length === 0) {
    return [];
  }
  // Acumulador local (builder): junta tokens enquanto o falante não muda; troca → novo grupo.
  const groups: Array<{ speaker: string | undefined; text: string }> = [];
  for (const t of finals) {
    const last = groups.at(-1);
    if (last && last.speaker === t.speaker) {
      last.text += t.text;
    } else {
      groups.push({ speaker: t.speaker, text: t.text });
    }
  }
  return groups
    .map((g) => ({ speaker: speakerToRole(g.speaker), text: g.text.trim(), ts }))
    .filter((c) => c.text.length > 0);
}

/** Relógio de timestamp "mm:ss" desde o início da sessão (injetável p/ testes). */
function clockMmss(startedAt: number, now: () => number): string {
  const elapsed = Math.max(0, Math.floor((now() - startedAt) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Cria a fonte Soniox. NÃO valida a chave (a validação real é a abertura do WS, do Mateus). Ao abrir,
 * envia a config inicial (api_key + modelo + diarização). Cada mensagem com tokens finais → 1 chunk.
 */
export function createSonioxSource(
  opts: SonioxOptions,
  factory: SonioxSocketFactory,
  now: () => number = Date.now,
): SonioxTranscriptSource {
  const url = opts.url ?? DEFAULT_URL;
  const socket = factory(url);
  const listeners = new Set<(c: TranscriptChunk) => void>();
  const startedAt = now();
  const onError = opts.onError ?? ((e: unknown) => logTransportError("soniox", e));

  socket.on("open", () => {
    socket.send(
      JSON.stringify({
        api_key: opts.apiKey,
        model: opts.model ?? DEFAULT_MODEL,
        enable_speaker_diarization: true,
        audio_format: "auto",
      }),
    );
  });

  socket.on("message", (raw) => {
    let parsed: { tokens?: SonioxToken[] };
    try {
      parsed = JSON.parse(String(raw)) as { tokens?: SonioxToken[] };
    } catch {
      return; // mensagem não-JSON (keepalive/erro) — ignora sem rebentar
    }
    const tokens = parsed.tokens;
    if (!Array.isArray(tokens)) {
      return;
    }
    for (const chunk of sonioxTokensToChunks(tokens, clockMmss(startedAt, now))) {
      for (const l of listeners) {
        l(chunk);
      }
    }
  });

  // Fail-loud: erro de transporte (ex.: chave inválida → auth reject) ou close pelo servidor NÃO
  // ficam silenciosos — senão a fonte simplesmente emudece (indistinguível de "ainda sem fala").
  socket.on("error", (e) => onError(e));
  socket.on("close", () => onError(new Error("ligação fechada pelo servidor")));

  return {
    subscribe(onChunk) {
      listeners.add(onChunk);
      return () => {
        listeners.delete(onChunk);
      };
    },
    sendAudio(bytes) {
      // A Soniox aceita binário; o nosso `SonioxSocket.send` é string p/ simplicidade do fake. Em
      // produção o adapter de WS real envia o ArrayBuffer/Buffer diretamente (ver wiring na app).
      socket.send(typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("base64"));
    },
    close() {
      socket.close();
    },
  };
}
