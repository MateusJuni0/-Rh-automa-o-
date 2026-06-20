import { describe, expect, it } from "vitest";
import { createOpenAiEmbedder, mockEmbedder } from "../src/index";

const DIM = 1536;
const vec = (seed: number): number[] => new Array(DIM).fill(seed);

/** `fetch` falso que devolve `body` com um dado status (sem rede). status≥400 → res.ok=false. */
function fakeFetch(body: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("mockEmbedder", () => {
  it("produz vetores dim 1536 normalizados (L2≈1)", async () => {
    const vecs = await mockEmbedder().embed(["olá mundo"]);
    const v = vecs[0] ?? [];
    expect(v).toHaveLength(1536);
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("é determinístico (mesmo texto → mesmo vetor)", async () => {
    const e = mockEmbedder();
    const [a] = await e.embed(["x"]);
    const [b] = await e.embed(["x"]);
    expect(a).toEqual(b);
  });

  it("textos diferentes → vetores diferentes", async () => {
    const [a, b] = await mockEmbedder().embed(["alfa", "beta"]);
    expect(a).not.toEqual(b);
  });
});

describe("createOpenAiEmbedder (real, fetch mockado)", () => {
  it("exige a chave (sem chave → erro, NÃO chamadas)", () => {
    expect(() => createOpenAiEmbedder({ apiKey: "" })).toThrow(/EMBEDDER_API_KEY/);
  });

  it("textos vazios → [] sem tocar na rede", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response("{}");
    }) as unknown as typeof fetch;
    const out = await createOpenAiEmbedder({ apiKey: "k", fetchImpl }).embed([]);
    expect(out).toEqual([]);
    expect(called).toBe(false);
  });

  it("devolve os vetores na ORDEM dos inputs (reordena por index)", async () => {
    const body = {
      data: [
        { index: 1, embedding: vec(0.2) },
        { index: 0, embedding: vec(0.1) },
      ],
    };
    const e = createOpenAiEmbedder({ apiKey: "k", fetchImpl: fakeFetch(body) });
    const out = await e.embed(["a", "b"]);
    expect(out[0]?.[0]).toBe(0.1);
    expect(out[1]?.[0]).toBe(0.2);
    expect(out[0]).toHaveLength(DIM);
  });

  it("HTTP não-2xx → erro", async () => {
    const e = createOpenAiEmbedder({ apiKey: "k", fetchImpl: fakeFetch({ error: "x" }, 401) });
    await expect(e.embed(["a"])).rejects.toThrow(/401/);
  });

  it("dimensão errada → erro (proteção do modelo)", async () => {
    const body = { data: [{ index: 0, embedding: [1, 2, 3] }] };
    const e = createOpenAiEmbedder({ apiKey: "k", fetchImpl: fakeFetch(body) });
    await expect(e.embed(["a"])).rejects.toThrow(/dim/);
  });
});
