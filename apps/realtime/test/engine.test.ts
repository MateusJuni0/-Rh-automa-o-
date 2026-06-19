import { mockRunSlotOptions, type TickOutput } from "@rh/ai";
import { FrameSession } from "@rh/ws";
import { describe, expect, it, vi } from "vitest";
import { createManualTranscriptSource, TickEngine, tickToFramePayloads } from "../src/index";

const ID1 = "11111111-1111-4111-8111-111111111111";

const cannedTick: TickOutput = {
  estado: {
    requisitos: [{ requisitoId: ID1, display: "React", status: "coberto-com-prova" }],
    interessesCliente: [],
    afirmacoesCandidato: [],
    perguntasFeitas: [],
    redFlags: [],
    resumoCorrente: "ok",
  },
  suggestion: { pergunta: "Aprofunda testes", lente: "gap", requisitoId: ID1 },
};

describe("TickEngine", () => {
  it("dispara um tick a cada N falas do candidato e produz EstadoVivo", async () => {
    const ticks: TickOutput[] = [];
    const engine = new TickEngine({
      requisitos: [{ requisitoId: ID1, display: "React" }],
      windowSize: 2,
      aiOptions: mockRunSlotOptions(() => JSON.stringify(cannedTick)),
      onTick: (out) => {
        ticks.push(out);
      },
    });
    const { source, push } = createManualTranscriptSource();
    engine.attach(source);

    push({ speaker: "recruiter", text: "fala-me de React", ts: "00:01" });
    push({ speaker: "candidate", text: "uso hooks", ts: "00:02" });
    expect(ticks).toHaveLength(0); // 1 fala do candidato < windowSize 2

    push({ speaker: "candidate", text: "e reconciliation", ts: "00:03" });
    await vi.waitFor(() => expect(ticks).toHaveLength(1));
    expect(ticks[0]?.estado.requisitos[0]?.requisitoId).toBe(ID1);
  });
});

describe("tickToFramePayloads", () => {
  it("produz tick.update + suggestion.next, build com seq via FrameSession", () => {
    const payloads = tickToFramePayloads(ID1, cannedTick);
    expect(payloads[0]?.type).toBe("tick.update");
    expect(payloads[1]?.type).toBe("suggestion.next");

    const session = new FrameSession();
    const f0 = payloads[0] ? session.build(payloads[0]) : undefined;
    expect(f0?.seq).toBe(0);
  });
});
