import { describe, expect, it } from "vitest";
import {
  buildParecer,
  type MatchInput,
  matchCandidate,
  mockRunSlotOptions,
  type ParecerInput,
} from "../src/index";

const roleProfile = {
  competencias: [{ skill: "React", nivel: "obrigatório" }],
  oQueEBom: { React: "explica reconciliation" },
  sinaisNivelErrado: [],
  linguagemFilipa: { React: "biblioteca web" },
  perguntasChave: [],
  sources: [],
};

const matchInput: MatchInput = {
  candidate: { name: "João", profile: { anos: 5 } },
  roleProfile,
  requirements: { must: ["React"] },
};

describe("matchCandidate (P1.4)", () => {
  it("devolve o MatchResult validado do output do slot", async () => {
    const canned = { matchScore: 78, gapsAInvestigar: ["testes"], pontosFortes: ["React"] };
    const opts = mockRunSlotOptions(() => JSON.stringify(canned));
    expect(await matchCandidate(matchInput, opts)).toEqual(canned);
  });

  it("rejeita output que não bate no schema (após retry)", async () => {
    const opts = mockRunSlotOptions(() => JSON.stringify({ matchScore: "alto" }));
    await expect(matchCandidate(matchInput, opts)).rejects.toBeTruthy();
  });
});

describe("buildParecer (P3.1)", () => {
  const parecerInput: ParecerInput = {
    candidate: { name: "João" },
    clientCriteria: [{ criterio: "Liderança", peso: "must" }],
    factos: [{ competencia: "React", factText: "domina hooks", rubricLevel: "forte" }],
  };
  const cannedParecer = {
    veredito: "Recomendo avançar.",
    criterios: [
      {
        criterio: "Liderança",
        resposta: "não-confirmado",
        citacao: null,
        timestamp: null,
        leitura: "Não confirmado nesta entrevista.",
      },
    ],
    forcas: ["React forte"],
    riscos: ["Liderança por sondar"],
    logistica: {
      salario: null,
      avisoPrevio: null,
      disponibilidade: null,
      remoto: null,
      riscoContraproposta: null,
    },
    anguloVenda: "Encaixa no driver frontend.",
    credenciaisAVerificar: [],
    naoCapturado: [],
    fontes: [],
  };

  it("devolve o Parecer validado do output do slot", async () => {
    const opts = mockRunSlotOptions(() => JSON.stringify(cannedParecer));
    const res = await buildParecer(parecerInput, opts);
    expect(res.veredito).toBe("Recomendo avançar.");
    expect(res.criterios[0]?.resposta).toBe("não-confirmado");
  });
});
