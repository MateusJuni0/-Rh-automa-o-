import { describe, expect, it } from "vitest";
import { candidateProfile, jobRequirements } from "../src/index";

describe("jobRequirements (P1.1)", () => {
  it("aceita um shape válido", () => {
    expect(
      jobRequirements.safeParse({
        roleType: "dev_frontend_react_pleno",
        nivel: "pleno",
        skills: { must: ["React"], nice: ["Next.js"] },
        contexto: "equipa de 5",
      }).success,
    ).toBe(true);
  });
  it("exige skills.must e skills.nice como arrays", () => {
    expect(
      jobRequirements.safeParse({
        roleType: "x",
        nivel: "pleno",
        skills: { must: "React" },
        contexto: "",
      }).success,
    ).toBe(false);
  });
});

describe("candidateProfile (P1.3)", () => {
  it("aceita experienciaAnos nulável + resumo opcional", () => {
    expect(
      candidateProfile.safeParse({
        skillsDeclaradas: ["React"],
        experienciaAnos: null,
        gapsCv: ["testes"],
      }).success,
    ).toBe(true);
  });
  it("rejeita skillsDeclaradas não-array", () => {
    expect(
      candidateProfile.safeParse({ skillsDeclaradas: "React", experienciaAnos: 3, gapsCv: [] })
        .success,
    ).toBe(false);
  });
});
