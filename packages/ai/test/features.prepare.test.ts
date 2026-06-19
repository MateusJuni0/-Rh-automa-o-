import { describe, expect, it } from "vitest";
import { buildRubric, mockRunSlotOptions, type RubricInput } from "../src/index";

const input: RubricInput = {
  roleProfile: {
    competencias: [{ skill: "React", nivel: "obrigatório" }],
    oQueEBom: { React: "explica reconciliation" },
    sinaisNivelErrado: [],
    linguagemFilipa: {},
    perguntasChave: [],
    sources: [],
  },
  clientCriteria: [{ criterio: "Liderança", peso: "must" }],
};

const draftCriterion = {
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

describe("buildRubric (P1.5, §16F)", () => {
  it("o sistema atribui requisitoId (UUID) — não o LLM", async () => {
    const opts = mockRunSlotOptions(() => JSON.stringify({ criteria: [draftCriterion] }));
    const rubric = await buildRubric(input, opts);

    expect(rubric.version).toBe(1);
    expect(rubric.criteria).toHaveLength(1);
    const crit = rubric.criteria[0];
    expect(crit?.requisito).toBe("React");
    // requisitoId foi gerado pelo sistema e é um UUID válido
    expect(crit?.requisitoId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("dois critérios recebem ids distintos", async () => {
    const opts = mockRunSlotOptions(() =>
      JSON.stringify({ criteria: [draftCriterion, { ...draftCriterion, requisito: "TS" }] }),
    );
    const rubric = await buildRubric(input, opts);
    expect(rubric.criteria[0]?.requisitoId).not.toBe(rubric.criteria[1]?.requisitoId);
  });
});
