import { describe, expect, it, vi } from "vitest";
import { createFaceClient, createMockFaceClient } from "../lib/face";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createMockFaceClient", () => {
  it("challenge fixo + verify sempre vivo/match (demo)", async () => {
    const c = createMockFaceClient();
    const ch = await c.challenge();
    expect(ch.sequence.length).toBeGreaterThanOrEqual(3);
    const v = await c.verify("u", ch.token, []);
    expect(v).toMatchObject({ match: true, liveness_ok: true });
  });
});

describe("createFaceClient (fetch mockado, sem rede)", () => {
  it("challenge → valida e devolve a sequência + token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        sequence: [
          [255, 0, 0],
          [0, 255, 0],
          [0, 0, 255],
        ],
        token: "tok-123",
      }),
    ) as unknown as typeof fetch;
    const c = createFaceClient({ baseUrl: "http://face:8000/", fetchImpl });
    const ch = await c.challenge();
    expect(ch.token).toBe("tok-123");
    expect(ch.sequence).toHaveLength(3);
  });

  it("verify → envia user_id/token/frames e devolve o resultado validado", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return jsonResponse({ match: true, score: 0.97, liveness_ok: true, reason: null });
    }) as unknown as typeof fetch;
    const c = createFaceClient({ baseUrl: "http://face:8000", s2sSecret: "s2s", fetchImpl });
    const v = await c.verify("filipa", "tok", [{ imageB64: "abc", measuredColor: [255, 0, 0] }]);
    expect(v.match).toBe(true);
    expect(calls[0]?.url).toBe("http://face:8000/verify");
    expect(calls[0]?.body).toMatchObject({
      user_id: "filipa",
      challenge_token: "tok",
      frames: [{ image_b64: "abc", measured_color: [255, 0, 0] }],
    });
  });

  it("serviço devolve erro → lança (sem falha silenciosa)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ detail: "boom" }, 400),
    ) as unknown as typeof fetch;
    const c = createFaceClient({ baseUrl: "http://face:8000", fetchImpl });
    await expect(c.challenge()).rejects.toThrow(/400/);
  });
});
