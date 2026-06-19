import { describe, expect, it } from "vitest";
import { planResponse } from "../lib/assistant/chat";

describe("planResponse (planner mock — intenção)", () => {
  it("deteta comparar", () => {
    const p = planResponse("compara o João e a Maria");
    expect(p.toolCalls.map((t) => t.tool)).toEqual(["comparar_candidatos"]);
  });

  it("deteta enviar email (efeito que pede confirmação)", () => {
    const p = planResponse("envia o email ao cliente");
    expect(p.toolCalls[0]?.tool).toBe("enviar_email");
  });

  it("deteta planilha e sourcing", () => {
    expect(planResponse("exporta uma planilha do pipeline").toolCalls[0]?.tool).toBe(
      "gen_spreadsheet",
    );
    expect(planResponse("faz sourcing de devs React").toolCalls[0]?.tool).toBe("sourcing");
  });

  it("Q&A genérico → resposta sem tool-calls, cita o contexto", () => {
    const p = planResponse("o que achas dele?", { candidatos: ["João"] });
    expect(p.toolCalls).toHaveLength(0);
    expect(p.reply).toContain("João");
  });
});
