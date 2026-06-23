import { describe, expect, it } from "vitest";
import { estadoVivo, requisitoStatus, suggestion } from "../src/index";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

const validEstado = {
  requisitos: [
    {
      requisitoId: UUID,
      display: "React",
      status: "coberto-com-prova",
      confianca: "alta",
      evidencia: "12:03 descreveu reconciliation",
    },
    { requisitoId: UUID2, display: "Inglês", status: "não-tocado" },
  ],
  interessesCliente: [{ tema: "liderou time?", status: "não-tocado" }],
  afirmacoesCandidato: [{ t: "11:58", diz: "5 anos React", conflitoCv: "CV diz 3" }],
  perguntasFeitas: ["Fala-me de um bug difícil"],
  redFlags: [],
  resumoCorrente: "Sénior React, 5 anos declarados (CV diz 3).",
};

describe("frame — EstadoVivo (ARQUITETURA-TEMPO-REAL §2/§9)", () => {
  it("aceita um estado vivo completo e válido", () => {
    expect(estadoVivo.safeParse(validEstado).success).toBe(true);
  });

  it("rejeita status de requisito fora dos 4 canónicos (§9)", () => {
    const bad = {
      ...validEstado,
      requisitos: [{ requisitoId: UUID, display: "X", status: "meio-coberto" }],
    };
    expect(estadoVivo.safeParse(bad).success).toBe(false);
  });

  it("família F: requisito keia por UUID, não por texto", () => {
    const bad = {
      ...validEstado,
      requisitos: [{ requisitoId: "React", display: "React", status: "raso" }],
    };
    expect(estadoVivo.safeParse(bad).success).toBe(false);
  });

  it("requisitoStatus expõe exatamente os 4 estados canónicos", () => {
    expect([...requisitoStatus.options].sort()).toEqual([
      "coberto-com-prova",
      "contradito",
      "não-tocado",
      "raso",
    ]);
  });
});

describe("frame — Suggestion", () => {
  it("aceita sugestão geral (requisitoId nulo)", () => {
    expect(
      suggestion.safeParse({ pergunta: "Fala-me de testes", lente: "gap", requisitoId: null })
        .success,
    ).toBe(true);
  });

  it("aceita sugestão ligada a um requisito + rejeita lente inválida", () => {
    expect(
      suggestion.safeParse({ pergunta: "Explica hooks", lente: "tecnica", requisitoId: UUID })
        .success,
    ).toBe(true);
    expect(suggestion.safeParse({ pergunta: "x", lente: "outra", requisitoId: null }).success).toBe(
      false,
    );
  });
});
