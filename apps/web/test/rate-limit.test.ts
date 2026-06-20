import { beforeEach, describe, expect, it } from "vitest";
import { createLoginRateLimiter } from "../lib/rate-limit";

/**
 * TDD do rate-limit do login. Token-bucket simples + lockout temporário por chave (IP+email).
 * Relógio injetado (sem Date.now escondido) → testes deterministas, sem timers reais.
 */
describe("createLoginRateLimiter", () => {
  let now: number;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000_000;
  });

  it("permite as primeiras N tentativas e bloqueia a (N+1)ª", () => {
    const rl = createLoginRateLimiter(
      { maxAttempts: 5, windowMs: 60_000, lockoutMs: 300_000 },
      clock,
    );
    for (let i = 0; i < 5; i += 1) {
      expect(rl.check("ip|email").allowed).toBe(true);
      rl.recordFailure("ip|email");
    }
    const blocked = rl.check("ip|email");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isola chaves diferentes (IP+email distintos não se afetam)", () => {
    const rl = createLoginRateLimiter(
      { maxAttempts: 2, windowMs: 60_000, lockoutMs: 300_000 },
      clock,
    );
    rl.recordFailure("a");
    rl.recordFailure("a");
    expect(rl.check("a").allowed).toBe(false);
    expect(rl.check("b").allowed).toBe(true);
  });

  it("o sucesso limpa o contador (recordSuccess)", () => {
    const rl = createLoginRateLimiter(
      { maxAttempts: 3, windowMs: 60_000, lockoutMs: 300_000 },
      clock,
    );
    rl.recordFailure("k");
    rl.recordFailure("k");
    rl.recordSuccess("k");
    // contador limpo → volta a ter as 3 tentativas
    for (let i = 0; i < 3; i += 1) {
      expect(rl.check("k").allowed).toBe(true);
      rl.recordFailure("k");
    }
    expect(rl.check("k").allowed).toBe(false);
  });

  it("o lockout expira depois de lockoutMs", () => {
    const rl = createLoginRateLimiter(
      { maxAttempts: 2, windowMs: 60_000, lockoutMs: 300_000 },
      clock,
    );
    rl.recordFailure("k");
    rl.recordFailure("k");
    expect(rl.check("k").allowed).toBe(false);
    now += 300_001; // passa o lockout
    expect(rl.check("k").allowed).toBe(true);
  });

  it("a janela deslizante esquece falhas antigas (não acumula para sempre)", () => {
    const rl = createLoginRateLimiter(
      { maxAttempts: 3, windowMs: 60_000, lockoutMs: 300_000 },
      clock,
    );
    rl.recordFailure("k");
    rl.recordFailure("k");
    now += 60_001; // as 2 falhas saem da janela
    rl.recordFailure("k");
    // só 1 falha dentro da janela → ainda permite
    expect(rl.check("k").allowed).toBe(true);
  });

  it("retryAfterSeconds reflete o tempo restante do lockout", () => {
    const rl = createLoginRateLimiter(
      { maxAttempts: 1, windowMs: 60_000, lockoutMs: 120_000 },
      clock,
    );
    rl.recordFailure("k");
    const r = rl.check("k");
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBe(120);
    now += 60_000;
    expect(rl.check("k").retryAfterSeconds).toBe(60);
  });
});
