import { describe, expect, it } from "vitest";
import {
  type BriefingInput,
  buildBriefing,
  buildRoleProfile,
  mockRunSlotOptions,
  type RoleProfileInput,
} from "../src/index";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

describe("buildRoleProfile (P1.2)", () => {
  it("estrutura a pesquisa num RoleProfile válido", async () => {
    const canned = {
      competencias: [{ skill: "React", nivel: "obrigatório" }],
      oQueEBom: { React: "explica reconciliation" },
      sinaisNivelErrado: [],
      linguagemFilipa: {},
      perguntasChave: [],
      sources: [],
    };
    const input: RoleProfileInput = { roleType: "dev_frontend_react_pleno", pesquisa: "texto..." };
    const opts = mockRunSlotOptions(() => JSON.stringify(canned));
    expect(await buildRoleProfile(input, opts)).toEqual(canned);
  });
});

describe("buildBriefing (P1.5, §16F)", () => {
  it("mantém requisitoId conhecido e anula o desconhecido", async () => {
    const input: BriefingInput = {
      roleProfile: {
        competencias: [],
        oQueEBom: {},
        sinaisNivelErrado: [],
        linguagemFilipa: {},
        perguntasChave: [],
        sources: [],
      },
      rubric: [{ requisitoId: ID1, requisito: "React" }],
    };
    const canned = {
      perguntas: [
        { pergunta: "Q1", lente: "tecnica", boaResposta: "...", requisitoId: ID1 },
        { pergunta: "Q2", lente: "gap", boaResposta: "...", requisitoId: ID2 }, // desconhecido
      ],
    };
    const opts = mockRunSlotOptions(() => JSON.stringify(canned));
    const res = await buildBriefing(input, opts);
    expect(res.perguntas[0]?.requisitoId).toBe(ID1);
    expect(res.perguntas[1]?.requisitoId).toBe(null); // anulado
  });
});
