import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  GenerateParseError,
  generate,
  type LlmTransport,
  mockFallback,
  mockRegistry,
  mockRunSlotOptions,
} from "../src/index";

const schema = z.object({ ok: z.boolean(), n: z.number() });
const prompt = { system: "devolve JSON", user: "dá-me ok=true n=1" };

/** Transporte com uma fila de respostas (uma por chamada). */
function queueTransport(contents: string[]): LlmTransport {
  let i = 0;
  return {
    complete(modelId) {
      const content = contents[Math.min(i, contents.length - 1)] ?? "{}";
      i += 1;
      return Promise.resolve({ modelId, content });
    },
  };
}

describe("generate — output validado por Zod", () => {
  it("devolve o objeto quando o JSON é válido à primeira", async () => {
    const opts = mockRunSlotOptions(() => JSON.stringify({ ok: true, n: 1 }));
    expect(await generate("EXTRACTOR", prompt, schema, opts)).toEqual({ ok: true, n: 1 });
  });

  it("tolera ```json … ``` à volta", async () => {
    const opts = mockRunSlotOptions(() => '```json\n{ "ok": false, "n": 2 }\n```');
    expect(await generate("EXTRACTOR", prompt, schema, opts)).toEqual({ ok: false, n: 2 });
  });

  it("faz 1 retry quando o 1º output é inválido e o 2º é válido", async () => {
    const transport = queueTransport(["não é json", JSON.stringify({ ok: true, n: 3 })]);
    const opts = { registry: mockRegistry, fallback: mockFallback, transport };
    expect(await generate("ARCHITECT", prompt, schema, opts)).toEqual({ ok: true, n: 3 });
  });

  it("lança GenerateParseError quando falha duas vezes", async () => {
    const transport = queueTransport(["lixo", "ainda lixo"]);
    const opts = { registry: mockRegistry, fallback: mockFallback, transport };
    await expect(generate("LIVE", prompt, schema, opts)).rejects.toBeInstanceOf(GenerateParseError);
  });
});
