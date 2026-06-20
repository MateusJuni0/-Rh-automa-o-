import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste do route /api/auth/login no modo MOCK (sem env Supabase). Foca no rate-limit:
 * N falhas (credenciais inválidas) → a (N+1)ª devolve 429 com Retry-After, mesmo que as credenciais
 * passassem a estar certas (o lockout protege a chave IP+email). Os cookies do Next são stubados.
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

function makeRequest(body: unknown, ip = "203.0.113.7"): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login — rate-limit (modo mock)", () => {
  beforeEach(() => {
    jar.store.clear();
    vi.resetModules();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("credenciais válidas → 200 (sem env, login mock)", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "filipa@iris.tech", password: "x" }));
    expect(res.status).toBe(200);
  });

  it("bloqueia (429) após o limite de falhas para a mesma chave IP+email", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    // email desconhecido + password não-vazia → passa o schema (Zod), falha a auth → 401
    const bad = { email: "filipa@iris.tech", password: "errada" };
    // NOTA: no mock, "filipa@iris.tech" + qualquer password não-vazia AUTENTICA. Para forçar 401,
    // usamos um email desconhecido (mesma conta-alvo não importa: a chave de IP também trava).
    const wrong = { email: "ataque@desconhecido.pt", password: "errada" };
    let last = 0;
    for (let i = 0; i < 5; i += 1) {
      const r = await POST(makeRequest(wrong));
      last = r.status;
    }
    expect(last).toBe(401);
    // 6ª tentativa, agora com credenciais "válidas" → o lockout por IP deve impedir (429)
    const blocked = await POST(makeRequest({ ...bad, password: "x" }));
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
    for (let i = 0; i < 5; i += 1) {
      const r = await POST(makeRequest({ nope: true }, "192.0.2.50"));
      expect(r.status).toBe(400);
    }
    const blocked = await POST(
      makeRequest({ email: "filipa@iris.tech", password: "x" }, "192.0.2.50"),
    );
    expect(blocked.status).toBe(429);
  });
});
