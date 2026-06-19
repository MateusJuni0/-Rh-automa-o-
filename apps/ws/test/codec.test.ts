import { describe, expect, it } from "vitest";
import { buildServerFrame, FrameSession, parseClientMessage, SeqCounter } from "../src/index";

const UUID = "11111111-1111-4111-8111-111111111111";

const estadoVazio = {
  requisitos: [],
  interessesCliente: [],
  afirmacoesCandidato: [],
  perguntasFeitas: [],
  redFlags: [],
  resumoCorrente: "",
};

describe("parseClientMessage", () => {
  it("parseia auth (string JSON) e ack (objeto)", () => {
    const auth = parseClientMessage(
      JSON.stringify({ type: "auth", accessToken: "jwt", interviewId: UUID }),
    );
    expect(auth.ok).toBe(true);
    expect(parseClientMessage({ type: "ack", lastSeq: 3 }).ok).toBe(true);
  });

  it("rejeita JSON malformado e frames inválidos", () => {
    expect(parseClientMessage("{não é json").ok).toBe(false);
    expect(parseClientMessage({ type: "auth", accessToken: "", interviewId: UUID }).ok).toBe(false);
    expect(parseClientMessage({ type: "desconhecido" }).ok).toBe(false);
  });
});

describe("SeqCounter", () => {
  it("incrementa monotonicamente a partir de 0", () => {
    const s = new SeqCounter();
    expect(s.current).toBe(-1);
    expect(s.next()).toBe(0);
    expect(s.next()).toBe(1);
    expect(s.current).toBe(1);
  });
});

describe("buildServerFrame", () => {
  it("injeta v + seq e valida o frame", () => {
    expect(buildServerFrame({ type: "auth.ok" }, 0)).toEqual({ type: "auth.ok", v: 1, seq: 0 });
  });

  it("rejeita payload inválido (auth.error com code fora de 4401/4403)", () => {
    // @ts-expect-error code inválido — barrado em compilação E runtime
    expect(() => buildServerFrame({ type: "auth.error", code: 4500 }, 0)).toThrow();
  });

  it("constrói tick.update com EstadoVivo e o seq dado", () => {
    const frame = buildServerFrame(
      { type: "tick.update", interviewId: UUID, estado: estadoVazio },
      5,
    );
    expect(frame.seq).toBe(5);
    expect(frame.type).toBe("tick.update");
  });
});

describe("FrameSession", () => {
  it("emite seq incremental por frame (fiabilidade)", () => {
    const session = new FrameSession();
    const a = session.build({ type: "interview.active", interviewId: UUID, on: true });
    const b = session.build({ type: "alert", interviewId: UUID, texto: "5 anos vs CV 3" });
    expect(a.seq).toBe(0);
    expect(b.seq).toBe(1);
    expect(session.lastSeq).toBe(1);
  });
});
