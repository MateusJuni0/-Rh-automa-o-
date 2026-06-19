import { describe, expect, it } from "vitest";
import { createOpenRouterTransport } from "../src/index";

const req = { messages: [{ role: "user", content: "oi" }] };

function transportWith(fetchImpl: typeof fetch) {
  return createOpenRouterTransport({ apiKey: "test-key", fetchImpl });
}

describe("createOpenRouterTransport", () => {
  it("exige apiKey", () => {
    expect(() => createOpenRouterTransport({ apiKey: "" })).toThrow();
  });

  it("devolve o content em sucesso", async () => {
    const t = transportWith(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "olá" } }] }), {
          status: 200,
        }),
    );
    expect(await t.complete("p/m", req)).toEqual({ modelId: "p/m", content: "olá" });
  });

  it("429 e 5xx → transient", async () => {
    for (const status of [429, 500, 503]) {
      const t = transportWith(async () => new Response("x", { status }));
      await expect(t.complete("p/m", req)).rejects.toMatchObject({ kind: "transient" });
    }
  });

  it("4xx (≠429) → permanent", async () => {
    const t = transportWith(async () => new Response("bad", { status: 400 }));
    await expect(t.complete("p/m", req)).rejects.toMatchObject({ kind: "permanent" });
  });

  it("falha de rede → transient", async () => {
    const t = transportWith(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(t.complete("p/m", req)).rejects.toMatchObject({ kind: "transient" });
  });

  it("resposta em formato inesperado → permanent", async () => {
    const t = transportWith(
      async () => new Response(JSON.stringify({ nope: true }), { status: 200 }),
    );
    await expect(t.complete("p/m", req)).rejects.toMatchObject({ kind: "permanent" });
  });
});
