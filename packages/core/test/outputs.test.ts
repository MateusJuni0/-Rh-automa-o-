import { describe, expect, it } from "vitest";
import { intakeEnvelope, matchResult, parecer } from "../src/index";

describe("MatchResult (PLANO P1.4)", () => {
  it("aceita score + gaps + forças", () => {
    expect(
      matchResult.safeParse({
        matchScore: 72,
        gapsAInvestigar: ["testes"],
        pontosFortes: ["React"],
      }).success,
    ).toBe(true);
  });
  it("exige matchScore numérico e arrays de strings", () => {
    expect(
      matchResult.safeParse({ matchScore: "alto", gapsAInvestigar: [], pontosFortes: [] }).success,
    ).toBe(false);
  });
});

describe("IntakeEnvelope (INTAKE §) — entrada tipada, alvo nunca adivinhado", () => {
  it("aceita envelope com alvo + intenção válidos (alvoId nulável)", () => {
    expect(
      intakeEnvelope.safeParse({
        alvo: "vaga",
        alvoId: null,
        intencao: "add_requisito",
        conteudo: "precisa também de Kubernetes",
      }).success,
    ).toBe(true);
  });
  it("rejeita alvo/intenção fora do enum", () => {
    expect(
      intakeEnvelope.safeParse({ alvo: "empresa", alvoId: null, intencao: "setup", conteudo: "x" })
        .success,
    ).toBe(false);
    expect(
      intakeEnvelope.safeParse({ alvo: "vaga", alvoId: null, intencao: "apagar", conteudo: "x" })
        .success,
    ).toBe(false);
  });
});

describe("Parecer (RELATORIO-CLIENTE §3)", () => {
  const validParecer = {
    veredito: "Recomendo avançar — forte em React, a confirmar liderança.",
    criterios: [
      {
        criterio: "Experiência React",
        resposta: "coberto-com-prova",
        citacao: "refiz o pipeline da equipa",
        timestamp: "34:12",
        leitura: "Domina React a nível pleno.",
      },
      {
        criterio: "Liderança de equipa",
        resposta: "não-confirmado",
        citacao: null,
        timestamp: null,
        leitura: "Não foi confirmado nesta entrevista.",
      },
    ],
    forcas: ["Comunicação clara"],
    riscos: ["Liderança por sondar"],
    logistica: {
      salario: "3500€",
      avisoPrevio: "30 dias",
      disponibilidade: "imediata",
      remoto: "híbrido",
      riscoContraproposta: null,
    },
    anguloVenda: "Encaixa no driver de escalar a equipa frontend.",
    credenciaisAVerificar: [
      { credencial: "Cédula da Ordem", estado: "por_verificar", docRef: null },
    ],
    naoCapturado: [{ inicio: "12:03", fim: "12:07", causa: "stt_reconnect" }],
    fontes: ["chunk:abc"],
  };

  it("aceita um parecer completo e bem-formado", () => {
    expect(parecer.safeParse(validParecer).success).toBe(true);
  });

  it("exige resposta de critério dentro do enum (RELATORIO §3)", () => {
    const bad = {
      ...validParecer,
      criterios: [{ ...validParecer.criterios[0], resposta: "talvez" }],
    };
    expect(parecer.safeParse(bad).success).toBe(false);
  });

  it("credencial só aceita estados regulados (§11)", () => {
    const bad = {
      ...validParecer,
      credenciaisAVerificar: [{ credencial: "X", estado: "talvez", docRef: null }],
    };
    expect(parecer.safeParse(bad).success).toBe(false);
  });
});
