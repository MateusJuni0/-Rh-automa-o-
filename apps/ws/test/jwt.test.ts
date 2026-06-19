import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signJwt, verifyJwt } from "../src/jwt";

const SECRET = "dev-secret-not-real";
const NOW = 1_000_000;

describe("jwt HS256", () => {
  it("assina e verifica (round-trip)", () => {
    const token = signJwt({ sub: "filipa", exp: NOW + 100 }, SECRET);
    const r = verifyJwt(token, SECRET, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.sub).toBe("filipa");
    }
  });

  it("rejeita assinatura com segredo errado", () => {
    const token = signJwt({ sub: "filipa", exp: NOW + 100 }, SECRET);
    const r = verifyJwt(token, "outro-segredo", NOW);
    expect(r).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejeita token expirado", () => {
    const token = signJwt({ sub: "filipa", exp: NOW - 1 }, SECRET);
    expect(verifyJwt(token, SECRET, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejeita token malformado", () => {
    expect(verifyJwt("nope", SECRET, NOW).ok).toBe(false);
    expect(verifyJwt("a.b", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejeita header sem alg HS256 (anti algorithm-confusion)", () => {
    const body = Buffer.from(JSON.stringify({ sub: "x", exp: NOW + 100 })).toString("base64url");
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const data = `${header}.${body}`;
    const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
    expect(verifyJwt(`${data}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejeita payload adulterado (assinatura deixa de bater)", () => {
    const token = signJwt({ sub: "filipa", exp: NOW + 100 }, SECRET);
    const [h, , sig] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "intruso", exp: NOW + 100 })).toString("base64url")}.${sig}`;
    expect(verifyJwt(forged, SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
  });
});
