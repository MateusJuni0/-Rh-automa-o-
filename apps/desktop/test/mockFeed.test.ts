import { describe, expect, it } from "vitest";
import {
  goldenInterviewFrames,
  goldenInterviewScript,
  MOCK_INTERVIEW_ID,
} from "../src/overlay/mockFeed";
import { hudReduce, initialHudState } from "../src/overlay/reducer";
import type { HudState } from "../src/overlay/types";

const REQ_REACT = "11111111-1111-4111-8111-111111111111";
const REQ_TESTES = "44444444-4444-4444-8444-444444444444";

function feed(frames = goldenInterviewFrames()): HudState[] {
  const states: HudState[] = [];
  let s = initialHudState;
  for (const msg of frames) {
    s = hudReduce(s, { kind: "server", msg });
    states.push(s);
  }
  return states;
}

describe("golden interview (feed mock → reducer)", () => {
  it("os frames são válidos e em seq monótono", () => {
    const frames = goldenInterviewFrames();
    expect(frames.length).toBeGreaterThan(5);
    frames.forEach((f, i) => {
      expect(f.seq).toBe(i);
    });
  });

  it("a entrevista arranca a gravar", () => {
    const final = feed().at(-1) as HudState;
    expect(final.interviewActive).toBe(true);
    expect(final.recording).toBe(true);
  });

  it("a sugestão de React é auto-descartada quando o requisito fica coberto", () => {
    const states = feed();
    // Em algum ponto a sugestão atual é a de React…
    const sawReact = states.some((s) => s.suggestion?.requisitoId === REQ_REACT);
    expect(sawReact).toBe(true);
    // …e no fim já não é (foi coberta → auto-dismiss).
    const final = states.at(-1) as HudState;
    expect(final.suggestion?.requisitoId).not.toBe(REQ_REACT);
  });

  it("o semáforo reflete React coberto e Testes contradito", () => {
    const final = feed().at(-1) as HudState;
    expect(final.requisitos.find((r) => r.requisitoId === REQ_REACT)?.status).toBe(
      "coberto-com-prova",
    );
    expect(final.requisitos.find((r) => r.requisitoId === REQ_TESTES)?.status).toBe("contradito");
  });

  it("a rede de segurança do fim aparece como alerta", () => {
    const final = feed().at(-1) as HudState;
    expect(final.alerts.some((a) => a.includes("Antes de terminar"))).toBe(true);
  });

  it("o script agendado mantém a ordem e o interviewId", () => {
    const script = goldenInterviewScript(1000);
    expect(script[0]?.delayMs).toBe(0);
    expect(script[1]?.delayMs).toBe(1000);
    expect(script.every((f) => "msg" in f)).toBe(true);
    const active = script.find((f) => f.msg.type === "interview.active");
    expect(active?.msg.type === "interview.active" && active.msg.interviewId).toBe(
      MOCK_INTERVIEW_ID,
    );
  });
});
