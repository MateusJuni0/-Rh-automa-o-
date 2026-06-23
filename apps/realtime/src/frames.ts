import type { TickOutput } from "@rh/ai";
import type { ServerFramePayload } from "@rh/ws";

/**
 * Converte um `TickOutput` nos payloads de frame WS (`tick.update` + `suggestion.next`, se houver).
 * O `apps/ws` (FrameSession) injeta `v`+`seq` e empurra para o overlay.
 */
export function tickToFramePayloads(interviewId: string, out: TickOutput): ServerFramePayload[] {
  const frames: ServerFramePayload[] = [{ type: "tick.update", interviewId, estado: out.estado }];
  if (out.suggestion) {
    frames.push({
      type: "suggestion.next",
      interviewId,
      pergunta: out.suggestion.pergunta,
      lente: out.suggestion.lente,
      requisitoId: out.suggestion.requisitoId,
    });
  }
  return frames;
}
