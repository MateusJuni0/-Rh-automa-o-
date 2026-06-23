import { mockRunSlotOptions } from "@rh/ai";
import { describe, expect, it } from "vitest";
import { planResponseWithLlm } from "../lib/assistant/llm";
import { TOOLS } from "../lib/assistant/tools";

const toolList = Object.values(TOOLS).map((t) => ({ name: t.name, efeito: t.efeito }));

describe("planResponseWithLlm — planner LLM (transporte mockado, sem rede)", () => {
  it("mapeia o JSON do LLM ao ChatPlan", async () => {
    const opts = mockRunSlotOptions(() =>
      JSON.stringify({
        reply: "Vou comparar os candidatos.",
        toolCalls: [{ tool: "comparar_candidatos", args: { ids: ["a", "b"] } }],
      }),
    );
    const plan = await planResponseWithLlm(
      { message: "compara o João e a Ana", ctx: { candidatos: ["João", "Ana"] }, tools: toolList },
      opts,
    );
    expect(plan).toEqual({
      reply: "Vou comparar os candidatos.",
      toolCalls: [{ tool: "comparar_candidatos", args: { ids: ["a", "b"] } }],
    });
  });

  it("enviar_email continua a ser PLANEADO (a porta é que exige confirmação, não o LLM)", async () => {
    const opts = mockRunSlotOptions(() =>
      JSON.stringify({
        reply: "Vou enviar o email ao cliente.",
        toolCalls: [{ tool: "enviar_email", args: { to: "cliente" } }],
      }),
    );
    const plan = await planResponseWithLlm(
      { message: "envia email ao cliente", ctx: {}, tools: toolList },
      opts,
    );
    expect(plan.toolCalls).toEqual([{ tool: "enviar_email", args: { to: "cliente" } }]);
    // O LLM NUNCA marca confirmação: o plano não tem qualquer flag de confirmado.
    expect(JSON.stringify(plan)).not.toContain("confirmed");
  });

  it("filtra tool-calls a ferramentas DESCONHECIDAS (anti-alucinação)", async () => {
    const opts = mockRunSlotOptions(() =>
      JSON.stringify({
        reply: "ok",
        toolCalls: [
          { tool: "ferramenta_inexistente", args: {} },
          { tool: "ler_agenda", args: {} },
        ],
      }),
    );
    const plan = await planResponseWithLlm(
      { message: "qualquer coisa", ctx: {}, tools: toolList },
      opts,
    );
    expect(plan.toolCalls).toEqual([{ tool: "ler_agenda", args: {} }]);
  });

  it("Q&A sem tools → toolCalls vazio", async () => {
    const opts = mockRunSlotOptions(() =>
      JSON.stringify({ reply: "Pela transcrição, o candidato tem 5 anos de experiência." }),
    );
    const plan = await planResponseWithLlm(
      { message: "quantos anos tem o candidato?", ctx: {}, tools: toolList },
      opts,
    );
    expect(plan.toolCalls).toEqual([]);
    expect(plan.reply).toContain("5 anos");
  });
});
