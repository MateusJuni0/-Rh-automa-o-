import { describe, expect, it } from "vitest";
import { mockEmbedder } from "../src/index";

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
