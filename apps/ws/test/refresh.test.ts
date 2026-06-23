import { describe, expect, it } from "vitest";
import { verifyJwt } from "../src/jwt";
import {
  DEFAULT_WS_TOKEN_TTL_SEC,
  issueWsToken,
  refreshWsToken,
  shouldRefresh,
} from "../src/refresh";

const SECRET = "dev-refresh-secret";
const SUB = "11111111-1111-4111-8111-111111111111";

describe("issueWsToken", () => {
  it("emite JWT curto válido com exp = now + ttl", () => {
    const now = 1_000_000;
    const token = issueWsToken({ recruiterId: SUB, secret: SECRET, ttlSec: 60, now });
    const v = verifyJwt(token, SECRET, now);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.sub).toBe(SUB);
      expect(v.payload.exp).toBe(now + 60);
    }
  });

  it("usa o TTL por defeito quando não dado", () => {
    const now = 1_000_000;
    const token = issueWsToken({ recruiterId: SUB, secret: SECRET, now });
    const v = verifyJwt(token, SECRET, now);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.exp).toBe(now + DEFAULT_WS_TOKEN_TTL_SEC);
    }
  });
});

describe("refreshWsToken — rotação ao nível do token", () => {
  it("token actual válido → novo token com exp renovado e mesmo sub", () => {
    const now = 1_000_000;
    const current = issueWsToken({ recruiterId: SUB, secret: SECRET, ttlSec: 30, now });
    const later = now + 20;
    const result = refreshWsToken({
      currentToken: current,
      secret: SECRET,
      ttlSec: 60,
      now: later,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const v = verifyJwt(result.token, SECRET, later);
      expect(v.ok).toBe(true);
      if (v.ok) {
        expect(v.payload.sub).toBe(SUB);
        expect(v.payload.exp).toBe(later + 60);
      }
      // Rotação real: o token novo difere do antigo.
      expect(result.token).not.toBe(current);
    }
  });

  it("token actual expirado → recusa (não re-emite)", () => {
    const now = 1_000_000;
    const current = issueWsToken({ recruiterId: SUB, secret: SECRET, ttlSec: 30, now });
    const afterExpiry = now + 31;
    const result = refreshWsToken({
      currentToken: current,
      secret: SECRET,
      ttlSec: 60,
      now: afterExpiry,
    });
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("token actual inválido (assinatura errada) → recusa", () => {
    const now = 1_000_000;
    const current = issueWsToken({ recruiterId: SUB, secret: "outro-secret", ttlSec: 30, now });
    const result = refreshWsToken({ currentToken: current, secret: SECRET, ttlSec: 60, now });
    expect(result.ok).toBe(false);
  });
});

describe("shouldRefresh — quando sinalizar auth.refresh_needed", () => {
  it("token longe de expirar → false", () => {
    expect(shouldRefresh({ exp: 1000, now: 900, thresholdSec: 30 })).toBe(false);
  });
  it("token dentro do threshold de expirar → true", () => {
    expect(shouldRefresh({ exp: 1000, now: 980, thresholdSec: 30 })).toBe(true);
  });
  it("token já expirado → true (precisa refresh imediato)", () => {
    expect(shouldRefresh({ exp: 1000, now: 1001, thresholdSec: 30 })).toBe(true);
  });
});
