import type { ServerMessage } from "@rh/core";
import { describe, expect, it } from "vitest";
import { goldenInterviewScript } from "../src/overlay/mockFeed";
import { playScript, type Scheduler } from "../src/renderer/hud/player";

/** Agendador falso: guarda os callbacks por delay; `fire()` corre-os por ordem. */
function fakeScheduler(): Scheduler & { fireAll(): void; cleared: number } {
  const jobs: Array<{ cb: () => void; ms: number; handle: number }> = [];
  let nextHandle = 0;
  let cleared = 0;
  return {
    set(cb, ms) {
      const handle = nextHandle++;
      jobs.push({ cb, ms, handle });
      return handle;
    },
    clear() {
      cleared += 1;
    },
    fireAll() {
      for (const j of [...jobs].sort((a, b) => a.ms - b.ms)) {
        j.cb();
      }
    },
    get cleared() {
      return cleared;
    },
  };
}

describe("playScript", () => {
  it("emite todos os frames por ordem de delay", () => {
    const sched = fakeScheduler();
    const got: ServerMessage[] = [];
    playScript(goldenInterviewScript(1000), (msg) => got.push(msg), sched);
    expect(got).toHaveLength(0); // nada antes do timer disparar
    sched.fireAll();
    const script = goldenInterviewScript(1000);
    expect(got.map((m) => m.seq)).toEqual(script.map((f) => f.msg.seq));
    expect(got[0]?.type).toBe("interview.active");
  });

  it("o cancelador limpa todos os timers agendados", () => {
    const sched = fakeScheduler();
    const cancel = playScript(goldenInterviewScript(), () => {}, sched);
    cancel();
    expect(sched.cleared).toBe(goldenInterviewScript().length);
  });
});
