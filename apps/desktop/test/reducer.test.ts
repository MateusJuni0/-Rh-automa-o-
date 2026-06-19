import { type RequisitoStatus, type ServerMessage, serverMessage } from "@rh/core";
import { describe, expect, it } from "vitest";
import { derivePorque, hudReduce, initialHudState } from "../src/overlay/reducer";
import type { HudState } from "../src/overlay/types";

const IID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REQ_A = "11111111-1111-4111-8111-111111111111";
const REQ_B = "44444444-4444-4444-8444-444444444444";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

let seq = 0;
function srv(state: HudState, msg: DistributiveOmit<ServerMessage, "v" | "seq">): HudState {
  seq += 1;
  const full = serverMessage.parse({ ...msg, v: 1, seq });
  return hudReduce(state, { kind: "server", msg: full });
}

function estado(
  reqs: Array<{ requisitoId: string; display: string; status: RequisitoStatus }>,
  resumo = "",
) {
  return {
    requisitos: reqs,
    interessesCliente: [],
    afirmacoesCandidato: [],
    perguntasFeitas: [],
    redFlags: [],
    resumoCorrente: resumo,
  };
}

describe("derivePorque", () => {
  it("usa o estado do requisito ligado", () => {
    const reqs = [{ requisitoId: REQ_A, display: "React", status: "raso" as const }];
    expect(derivePorque({ lente: "tecnica", requisitoId: REQ_A }, reqs)).toContain("falta prova");
  });
  it("cai na lente quando não há requisito", () => {
    expect(derivePorque({ lente: "cliente", requisitoId: null }, [])).toContain("cliente");
  });
});

describe("hudReduce", () => {
  it("auth.ok → live; interview.active liga gravação", () => {
    let s = hudReduce(initialHudState, { kind: "server", msg: { type: "auth.ok", v: 1, seq: 0 } });
    expect(s.conn).toBe("live");
    s = srv(s, { type: "interview.active", interviewId: IID, on: true });
    expect(s.interviewActive).toBe(true);
    expect(s.recording).toBe(true);
  });

  it("tick.update pinta o semáforo e o resumo", () => {
    const s = srv(initialHudState, {
      type: "tick.update",
      interviewId: IID,
      estado: estado([{ requisitoId: REQ_A, display: "React", status: "raso" }], "falou de React"),
    });
    expect(s.requisitos).toHaveLength(1);
    expect(s.requisitos[0]?.status).toBe("raso");
    expect(s.resumoCorrente).toBe("falou de React");
  });

  it("suggestion.next destaca e deriva o porquê do estado atual", () => {
    let s = srv(initialHudState, {
      type: "tick.update",
      interviewId: IID,
      estado: estado([{ requisitoId: REQ_A, display: "React", status: "raso" }]),
    });
    s = srv(s, {
      type: "suggestion.next",
      interviewId: IID,
      pergunta: "Como lida com listas grandes?",
      lente: "tecnica",
      requisitoId: REQ_A,
    });
    expect(s.suggestion?.pergunta).toBe("Como lida com listas grandes?");
    expect(s.suggestion?.porque).toContain("falta prova");
  });

  it("coverage.update que cobre o requisito da sugestão → auto-dismiss + promove a fila", () => {
    let s = srv(initialHudState, {
      type: "tick.update",
      interviewId: IID,
      estado: estado([
        { requisitoId: REQ_A, display: "React", status: "raso" },
        { requisitoId: REQ_B, display: "Testes", status: "não-tocado" },
      ]),
    });
    s = srv(s, {
      type: "suggestion.next",
      interviewId: IID,
      pergunta: "P1 React",
      lente: "tecnica",
      requisitoId: REQ_A,
    });
    s = srv(s, {
      type: "suggestion.next",
      interviewId: IID,
      pergunta: "P2 Testes",
      lente: "gap",
      requisitoId: REQ_B,
    });
    // P2 é a atual; P1 está na fila.
    expect(s.suggestion?.pergunta).toBe("P2 Testes");
    expect(s.queue.map((q) => q.pergunta)).toContain("P1 React");
    // Cobre REQ_B → a sugestão atual (P2) cai e promove P1 da fila.
    s = srv(s, {
      type: "coverage.update",
      interviewId: IID,
      requisitos: [{ requisitoId: REQ_B, status: "coberto-com-prova" }],
    });
    expect(s.suggestion?.pergunta).toBe("P1 React");
    expect(s.requisitos.find((r) => r.requisitoId === REQ_B)?.status).toBe("coberto-com-prova");
  });

  it("alert acumula sem duplicar; dismissSuggestion promove a fila", () => {
    let s = srv(initialHudState, { type: "alert", interviewId: IID, texto: "fecha já" });
    s = srv(s, { type: "alert", interviewId: IID, texto: "fecha já" });
    expect(s.alerts).toEqual(["fecha já"]);
    s = {
      ...s,
      suggestion: { pergunta: "A", lente: "tecnica", requisitoId: null, porque: "x" },
      queue: [{ pergunta: "B", lente: "gap", requisitoId: null, porque: "y" }],
    };
    s = hudReduce(s, { kind: "dismissSuggestion" });
    expect(s.suggestion?.pergunta).toBe("B");
    expect(s.queue).toHaveLength(0);
  });

  it("interview.active off limpa sugestões e gravação", () => {
    let s = srv(initialHudState, { type: "interview.active", interviewId: IID, on: true });
    s = srv(s, {
      type: "suggestion.next",
      interviewId: IID,
      pergunta: "x",
      lente: "tecnica",
      requisitoId: null,
    });
    s = srv(s, { type: "interview.active", interviewId: IID, on: false });
    expect(s.interviewActive).toBe(false);
    expect(s.recording).toBe(false);
    expect(s.suggestion).toBeNull();
  });

  it("conserva o último seq (para ack/replay)", () => {
    const s = hudReduce(initialHudState, {
      kind: "server",
      msg: { type: "auth.ok", v: 1, seq: 7 },
    });
    expect(s.lastSeq).toBe(7);
  });

  it("descarta frames repetidos/fora de ordem (proteção de replay)", () => {
    const live = hudReduce(initialHudState, {
      kind: "server",
      msg: { type: "auth.ok", v: 1, seq: 5 },
    });
    // Frame antigo (seq 3) tenta reverter para offline → ignorado.
    const after = hudReduce(live, {
      kind: "server",
      msg: { type: "auth.error", v: 1, seq: 3, code: 4401 },
    });
    expect(after).toBe(live);
    expect(after.conn).toBe("live");
  });
});
