import type { ServerMessage } from "@rh/core";
import type { ScheduledFrame } from "../../overlay/mockFeed";

/** Agendador injetável (real = setTimeout; testes = falso determinístico). */
export interface Scheduler {
  set(cb: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  set: (cb, ms) => setTimeout(cb, ms),
  // `handle` vem sempre do nosso próprio `set` acima → o tipo é conhecido (narrowing de fronteira).
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Reproduz um script de frames, emitindo cada um no seu `delayMs`. Devolve um cancelador. */
export function playScript(
  script: readonly ScheduledFrame[],
  emit: (msg: ServerMessage) => void,
  scheduler: Scheduler = realScheduler,
): () => void {
  const handles = script.map((frame) => scheduler.set(() => emit(frame.msg), frame.delayMs));
  return () => {
    for (const handle of handles) {
      scheduler.clear(handle);
    }
  };
}
