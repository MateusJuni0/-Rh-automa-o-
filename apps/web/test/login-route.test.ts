import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste do route /api/auth/login no modo MOCK (sem env Supabase). Foca no rate-limit:
 * N falhas (credenciais inválidas) → a (N+1)ª devolve 429 com Retry-After, mesmo que as credenciais
 * passassem a estar certas (o lockout protege a chave IP+email). Os cookies do Next são stubados.
 *
 * NOTA: o rate-limiter do route é um singleton de módulo (in-memory). Para isolar testes SEM
 * `vi.resetModules()` (que torna o re-import lento no Windows → timeouts), cada teste usa um IP
 * distinto — assim o estado de lockout de um teste não contamina o seguinte.
 */

// Stub do `next/headers` (cookies()) — não há request real do Next nos testes unitários.
const jar = {
  store: new Map<string, string>(),
  set(name: string, value: string) {
    this.store.set(name, value);
  },
  get(name: string) {
    const v = this.store.get(name);
    return v === undefined ? undefined : { value: v };
  },
};
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(jar),
}));

function makeRequest(body: unknown, ip: string): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

// Sem env Supabase → modo mock (login por email seed + password não-vazia).
beforeEach(() => {
  jar.store.clear();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/login — rate-limit (modo mock)", () => {
  it("credenciais válidas → 200 (sem env, login mock)", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    const res = await POST(
      makeRequest({ email: "filipa@iris.tech", password: "x" }, "203.0.113.1"),
    );
    expect(res.status).toBe(200);
  });

  it("bloqueia (429) após o limite de falhas para a mesma chave IP+email", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    const ip = "203.0.113.2";
    // email desconhecido + password não-vazia → passa o schema (Zod), falha a auth → 401
    const wrong = { email: "ataque@desconhecido.pt", password: "errada" };
    let last = 0;
    for (let i = 0; i < 5; i += 1) {
      const r = await POST(makeRequest(wrong, ip));
      last = r.status;
    }
    expect(last).toBe(401);
    // 6ª tentativa, agora com credenciais "válidas" → o lockout por IP deve impedir (429)
    const blocked = await POST(makeRequest({ email: "filipa@iris.tech", password: "x" }, ip));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("IPs distintos não partilham o lockout", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    const wrong = { email: "ataque@desconhecido.pt", password: "errada" };
    for (let i = 0; i < 5; i += 1) {
      await POST(makeRequest(wrong, "198.51.100.1"));
    }
    // outro IP → ainda permitido
    const other = await POST(
      makeRequest({ email: "filipa@iris.tech", password: "x" }, "198.51.100.99"),
    );
    expect(other.status).toBe(200);
  });

  it("requests malformados (400) também contam para o rate-limit por IP", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    const ip = "192.0.2.50";
    for (let i = 0; i < 5; i += 1) {
      const r = await POST(makeRequest({ nope: true }, ip));
      expect(r.status).toBe(400);
    }
    const blocked = await POST(makeRequest({ email: "filipa@iris.tech", password: "x" }, ip));
    expect(blocked.status).toBe(429);
  });
});
