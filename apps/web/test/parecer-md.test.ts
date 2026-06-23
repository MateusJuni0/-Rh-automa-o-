import type { Parecer } from "@rh/core";
import { describe, expect, it } from "vitest";
import { renderParecerMd } from "../lib/parecer";

const P: Parecer = {
  veredito: "Recomendado com reservas.",
  criterios: [
    {
      criterio: "React",
      resposta: "coberto-com-prova",
      citacao: "uso hooks há 3 anos",
      timestamp: "12:03",
      leitura: "Domínio sólido.",
    },
  ],
  forcas: ["Comunicação clara"],
  riscos: ["Pouca experiência em testes"],
  logistica: {
    salario: "3000€",
    avisoPrevio: "30 dias",
    disponibilidade: null,
    remoto: "híbrido",
    riscoContraproposta: null,
  },
  anguloVenda: "Disponível e motivado.",
  credenciaisAVerificar: [{ credencial: "Cédula", estado: "por_verificar", docRef: null }],
  naoCapturado: [{ inicio: "10:00", fim: null, causa: "network" }],
  fontes: ["tick #4"],
};

describe("renderParecerMd", () => {
  it("renderiza as secções principais com o nome do candidato", () => {
    const md = renderParecerMd("Ana Sousa", P);
    expect(md).toContain("# Parecer — Ana Sousa");
    expect(md).toContain("**Veredito:** Recomendado com reservas.");
    expect(md).toContain("## Critérios");
    expect(md).toContain("**React** — coberto-com-prova");
    expect(md).toContain("## Logística");
    expect(md).toContain("Salário: 3000€");
    expect(md).toContain("Não capturado 10:00–aberto (network)");
    expect(md).toContain("## Fontes");
  });

  it("é honesto quando há secções vazias", () => {
    const empty: Parecer = { ...P, criterios: [], naoCapturado: [], fontes: [] };
    const md = renderParecerMd("X", empty);
    expect(md).toContain("_Sem critérios avaliados._");
    expect(md).toContain("Captura completa.");
    expect(md).toContain("_Sem fontes._");
  });
});
