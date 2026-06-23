import { describe, expect, it } from "vitest";
import { appEnvironment, RETENTION_DEFAULTS } from "../lib/definicoes";

describe("definicoes (puro)", () => {
  it("appEnvironment mapeia NODE_ENV", () => {
    expect(appEnvironment("production")).toBe("produção");
    expect(appEnvironment("development")).toBe("desenvolvimento");
    expect(appEnvironment(undefined)).toBe("desenvolvimento");
  });

  it("RETENTION_DEFAULTS expõe as alavancas RGPD", () => {
    expect(RETENTION_DEFAULTS.length).toBeGreaterThanOrEqual(3);
    expect(RETENTION_DEFAULTS.every((r) => r.label && r.valor)).toBe(true);
  });
});
