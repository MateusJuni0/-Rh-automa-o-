import { describe, expect, it } from "vitest";
import { classifyIntake, mockRunSlotOptions } from "../src/index";

describe("classifyIntake", () => {
  it("valida o envelope devolvido pelo modelo (mock)", async () => {
    const env = await classifyIntake(
      "Encaminho o CV do João, dev backend",
      mockRunSlotOptions(() =>
        JSON.stringify({
          alvo: "candidato",
          alvoId: null,
          intencao: "novo_candidato",
          conteudo: "CV do João, dev backend",
        }),
      ),
    );
    expect(env.alvo).toBe("candidato");
    expect(env.intencao).toBe("novo_candidato");
    expect(env.alvoId).toBeNull();
  });
});
