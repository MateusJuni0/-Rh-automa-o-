import { describe, expect, it } from "vitest";
import { extractCandidateProfile, extractJobRequirements, mockRunSlotOptions } from "../src/index";

describe("extractJobRequirements (P1.1)", () => {
  it("devolve os requisitos validados do output do slot", async () => {
    const canned = {
      roleType: "dev_frontend_react_pleno",
      nivel: "pleno",
      skills: { must: ["React"], nice: [] },
      contexto: "startup",
    };
    const opts = mockRunSlotOptions(() => JSON.stringify(canned));
    expect(await extractJobRequirements("vaga: dev react...", opts)).toEqual(canned);
  });
});

describe("extractCandidateProfile (P1.3)", () => {
  it("devolve o perfil validado do output do slot", async () => {
    const canned = { skillsDeclaradas: ["React", "TS"], experienciaAnos: 5, gapsCv: ["testes"] };
    const opts = mockRunSlotOptions(() => JSON.stringify(canned));
    expect(await extractCandidateProfile("CV: 5 anos React...", opts)).toEqual(canned);
  });
});
