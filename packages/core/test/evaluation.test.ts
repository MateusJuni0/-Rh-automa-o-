import { describe, expect, it } from "vitest";
import { roleProfile, rubric, rubricCriterion } from "../src/index";

const UUID = "11111111-1111-4111-8111-111111111111";

const validRoleProfile = {
  competencias: [
    { skill: "hooks (useState, useEffect)", nivel: "obrigatório" },
    { skill: "TypeScript", nivel: "desejável", obrigatorio: false },
  ],
  oQueEBom: { React: "explica quando NÃO usaria useEffect" },
  sinaisNivelErrado: ["diz '5 anos' mas não cita um performance fix"],
  linguagemFilipa: { React: "biblioteca que faz páginas reagir sem recarregar" },
  perguntasChave: ["Conta um momento em que o app ficou lento."],
  sources: [{ url: "https://x", acedidoEm: "2026-06-16" }],
};

const validCriterion = {
  requisitoId: UUID,
  requisito: "React",
  perguntaSonda: "Explica reconciliation",
  fraco: "diz que sabe mas não explica",
  ok: "cita hooks",
  forte: "explica reconciliation",
  linguagemFilipa: { fraco: "...", ok: "...", forte: "..." },
  peso: "must",
  origem: "role_profile",
  originCriteriaId: null,
  tipo: "competencia",
};

describe("RoleProfile (CAMADA-CONHECIMENTO)", () => {
  it("aceita um Role Profile completo", () => {
    expect(roleProfile.safeParse(validRoleProfile).success).toBe(true);
  });

  it("exige competencias com {skill, nivel}", () => {
    const bad = { ...validRoleProfile, competencias: [{ skill: "X" }] };
    expect(roleProfile.safeParse(bad).success).toBe(false);
  });
});

describe("Rubric (INTAKE-E-JULGAMENTO Parte B)", () => {
  it("aceita um critério válido (keia por requisitoId — §16F)", () => {
    expect(rubricCriterion.safeParse(validCriterion).success).toBe(true);
  });

  it("rejeita peso/origem/tipo fora do enum", () => {
    expect(rubricCriterion.safeParse({ ...validCriterion, peso: "talvez" }).success).toBe(false);
    expect(rubricCriterion.safeParse({ ...validCriterion, origem: "inventado" }).success).toBe(
      false,
    );
    expect(rubricCriterion.safeParse({ ...validCriterion, tipo: "outro" }).success).toBe(false);
  });

  it("requisitoId tem de ser UUID (não texto livre)", () => {
    expect(rubricCriterion.safeParse({ ...validCriterion, requisitoId: "React" }).success).toBe(
      false,
    );
  });

  it("Rubric exige version>=1 e um array de criteria", () => {
    expect(rubric.safeParse({ version: 1, criteria: [validCriterion] }).success).toBe(true);
    expect(rubric.safeParse({ version: 0, criteria: [] }).success).toBe(false);
  });
});
