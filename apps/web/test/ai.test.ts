import { runSlot } from "@rh/ai";
import { describe, expect, it } from "vitest";
import { aiOptions } from "../lib/ai";

describe("aiOptions — sem chave usa o stub determinístico", () => {
  it("o transporte devolve o stub fornecido pela rota", async () => {
    // sem OPENROUTER_API_KEY no ambiente de teste → caminho stub
    const opts = aiOptions({
      roleType: "x",
      nivel: "pleno",
      skills: { must: [], nice: [] },
      contexto: "c",
    });
    const res = await runSlot("EXTRACTOR", { messages: [{ role: "user", content: "x" }] }, opts);
    expect(JSON.parse(res.content)).toMatchObject({ roleType: "x", nivel: "pleno" });
  });
});
