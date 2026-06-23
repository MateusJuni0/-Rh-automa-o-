import { describe, expect, it } from "vitest";
import { type AssistantPlanInput, assistantPlan, mockRunSlotOptions } from "../src/index";

const tools = [
  { name: "comparar_candidatos", efeito: "leitura" },
  { name: "ler_agenda", efeito: "leitura" },
  { name: "enviar_email", efeito: "enviar_fora" },
  { name: "save_memory_fact", efeito: "gravar" },
];

const base: Omit<AssistantPlanInput, "message"> = { tools };

describe("assistantPlan (Ω-2 planner LLM)", () => {
  it("valida e devolve o plano do output do slot", async () => {
    const opts = mockRunSlotOptions(() =>
      JSON.stringify({
        reply: "Comparei.",
        toolCalls: [{ tool: "comparar_candidatos", args: { ids: ["a"] } }],
      }),
    );
    const plan = await assistantPlan({ ...base, message: "compara" }, opts);
    expect(plan).toEqual({
      reply: "Comparei.",
      toolCalls: [{ tool: "comparar_candidatos", args: { ids: ["a"] } }],
    });
  });

  it("toolCalls em falta → default vazio (Q&A)", async () => {
    const opts = mockRunSlotOptions(() => JSON.stringify({ reply: "Resposta direta." }));
    const plan = await assistantPlan({ ...base, message: "pergunta" }, opts);
    expect(plan.toolCalls).toEqual([]);
  });

  it("args em falta → default {}", async () => {
    const opts = mockRunSlotOptions(() =>
      JSON.stringify({ reply: "ok", toolCalls: [{ tool: "ler_agenda" }] }),
    );
    const plan = await assistantPlan({ ...base, message: "agenda" }, opts);
    expect(plan.toolCalls).toEqual([{ tool: "ler_agenda", args: {} }]);
  });

  it("ferramenta desconhecida é filtrada (anti-alucinação)", async () => {
    const opts = mockRunSlotOptions(() =>
      JSON.stringify({
        reply: "ok",
        toolCalls: [
          { tool: "drop_database", args: {} },
          { tool: "enviar_email", args: { to: "x" } },
        ],
      }),
    );
    const plan = await assistantPlan({ ...base, message: "x" }, opts);
    expect(plan.toolCalls).toEqual([{ tool: "enviar_email", args: { to: "x" } }]);
  });

  it("enviar_email é PLANEADO (a confirmação é da porta, não do LLM)", async () => {
    const opts = mockRunSlotOptions(() =>
      JSON.stringify({ reply: "Vou enviar.", toolCalls: [{ tool: "enviar_email", args: {} }] }),
    );
    const plan = await assistantPlan({ ...base, message: "envia email" }, opts);
    expect(plan.toolCalls.map((c) => c.tool)).toEqual(["enviar_email"]);
    expect(JSON.stringify(plan)).not.toContain("confirmed");
  });
});
