import { LIVEKIT_ENABLED } from "./livekit";
import { SONIOX_ENABLED } from "./soniox";

/**
 * Seleção da fonte de transcrição (config-not-code). Liga a entrevista AO VIVO real só quando
 * AMBOS os lados estão configurados: LiveKit (transporte de áudio) E Soniox (STT). Meia-ligação
 * (um sim, outro não) → mock, para nunca correr um pipeline parcial silenciosamente.
 *
 * O resto do pipeline é o MESMO em qualquer modo: a fonte (real ou mock) → `TickEngine.attach` →
 * `tickToFramePayloads` → broadcast WS → overlay. Trocamos só a FONTE; não há frames inventados
 * fora do protocolo congelado (@rh/core).
 */
export type TranscriptMode = "live" | "mock";

export function chooseTranscriptMode(): TranscriptMode {
  return SONIOX_ENABLED() && LIVEKIT_ENABLED() ? "live" : "mock";
}
