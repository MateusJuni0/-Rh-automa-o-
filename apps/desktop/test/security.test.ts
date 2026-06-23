import { describe, expect, it } from "vitest";
import { buildCsp, navigationDecision, withCspHeader } from "../src/main/security";

const ALLOW = ["https://app.vera.example"];

describe("navigationDecision", () => {
  it("permite file: e a origem do backend; nega o resto e blob:/data:", () => {
    expect(navigationDecision("file:///index.html", ALLOW)).toBe("allow");
    expect(navigationDecision("https://app.vera.example/x", ALLOW)).toBe("allow");
    expect(navigationDecision("https://evil.example/x", ALLOW)).toBe("deny");
    expect(navigationDecision("blob:https://app.vera.example/u", ALLOW)).toBe("deny");
    expect(navigationDecision("data:text/html,x", ALLOW)).toBe("deny");
  });
});

describe("withCspHeader", () => {
  const csp = buildCsp({ connectSrc: ["wss://ws.vera.example"] });

  it("define a CSP e preserva os outros headers", () => {
    const out = withCspHeader({ "X-Frame-Options": ["DENY"] }, csp);
    expect(out["Content-Security-Policy"]).toEqual([csp]);
    expect(out["X-Frame-Options"]).toEqual(["DENY"]);
  });

  it("substitui qualquer CSP anterior (case-insensitive) e normaliza string→array", () => {
    const out = withCspHeader(
      { "content-security-policy": "default-src *", "Set-Cookie": "a=1" },
      csp,
    );
    // só uma CSP, com o nosso valor
    const keys = Object.keys(out).filter((k) => k.toLowerCase() === "content-security-policy");
    expect(keys).toEqual(["Content-Security-Policy"]);
    expect(out["Content-Security-Policy"]).toEqual([csp]);
    expect(out["Set-Cookie"]).toEqual(["a=1"]);
  });
});
