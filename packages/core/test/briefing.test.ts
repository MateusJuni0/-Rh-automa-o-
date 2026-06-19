import { describe, expect, it } from "vitest";
import { briefing } from "../src/index";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("briefing (P1.5)", () => {
  it("aceita perguntas em 3 lentes com boaResposta e requisitoId nulável", () => {
    expect(
      briefing.safeParse({
        perguntas: [
          { pergunta: "Explica hooks", lente: "tecnica", boaResposta: "...", requisitoId: UUID },
          { pergunta: "Liderou equipa?", lente: "cliente", boaResposta: "...", requisitoId: null },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejeita lente fora do enum", () => {
    expect(
      briefing.safeParse({
        perguntas: [{ pergunta: "x", lente: "outra", boaResposta: "y", requisitoId: null }],
      }).success,
    ).toBe(false);
  });
});
