import { describe, expect, it } from "vitest";
import { mockRunSlotOptions, runTick, type TickInput } from "../src/index";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

const input: TickInput = {
  requisitos: [{ requisitoId: ID1, display: "React" }],
  interessesCliente: [{ tema: "liderança" }],
  janela: "candidato: usei hooks para...",
};

describe("runTick (P2.3, §16F)", () => {
  it("descarta requisitos com id fora da rubric e anula suggestion.requisitoId desconhecido", async () => {
    const canned = {
      estado: {
        requisitos: [
          { requisitoId: ID1, display: "React", status: "coberto-com-prova" },
          { requisitoId: ID2, display: "Fantasma", status: "raso" }, // id desconhecido → fora
        ],
        interessesCliente: [],
        afirmacoesCandidato: [],
        perguntasFeitas: [],
        redFlags: [],
        resumoCorrente: "ok",
      },
      suggestion: { pergunta: "Aprofunda testes", lente: "gap", requisitoId: ID2 },
    };
    const opts = mockRunSlotOptions(() => JSON.stringify(canned));
    const out = await runTick(input, opts);

    expect(out.estado.requisitos).toHaveLength(1);
    expect(out.estado.requisitos[0]?.requisitoId).toBe(ID1);
    // a sugestão mantém-se mas o id desconhecido é anulado
    expect(out.suggestion?.requisitoId).toBe(null);
  });

  it("aceita suggestion null", async () => {
    const canned = {
      estado: {
        requisitos: [],
        interessesCliente: [],
        afirmacoesCandidato: [],
        perguntasFeitas: [],
        redFlags: [],
        resumoCorrente: "",
      },
      suggestion: null,
    };
    const opts = mockRunSlotOptions(() => JSON.stringify(canned));
    const out = await runTick(input, opts);
    expect(out.suggestion).toBe(null);
  });
});
