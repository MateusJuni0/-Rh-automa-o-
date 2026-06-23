import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAuthConfig } from "../lib/auth-config";

/**
 * Invariantes de arranque (fail-fast). Usa `vi.stubEnv` (type-safe + auto-limpo) p/ manipular
 * process.env, incluindo `NODE_ENV` (que é read-only no tipo).
 */
describe("assertAuthConfig (fail-fast no boot)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("config completa (URL + anon key) → não lança", () => {
    vi.stubEnv("SUPABASE_URL", "http://localhost:8000");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-xyz");
    expect(() => assertAuthConfig()).not.toThrow();
  });

  it("sem nenhuma env de auth → não lança (modo dev/mock legítimo)", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertAuthConfig()).not.toThrow();
  });

  it("URL presente mas anon key em FALTA → LANÇA (config meia-feita = perigosa)", () => {
    vi.stubEnv("SUPABASE_URL", "http://localhost:8000");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    expect(() => assertAuthConfig()).toThrow(/SUPABASE_ANON_KEY/);
  });

  it("anon key presente mas URL em falta → LANÇA", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-xyz");
    expect(() => assertAuthConfig()).toThrow(/SUPABASE_URL/);
  });

  it("produção sem auth E sem ALLOW_DEV_SESSION → LANÇA (não correr prod em modo mock por acidente)", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    vi.stubEnv("ALLOW_DEV_SESSION", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertAuthConfig()).toThrow(/produção/i);
  });

  it("produção sem auth MAS com ALLOW_DEV_SESSION=1 → não lança (escape hatch explícito)", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_SESSION", "1");
    expect(() => assertAuthConfig()).not.toThrow();
  });
});
