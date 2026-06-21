import { describe, expect, it } from "vitest";
import { assertCaptureAllowed, ConsentNotGrantedError, isRealCapture } from "../lib/consent";

describe("gate de consentimento (assertCaptureAllowed)", () => {
  it("captura 'none' passa sempre (v1 sem áudio), mesmo sem consentimento", () => {
    expect(() => assertCaptureAllowed("none", null)).not.toThrow();
    expect(() => assertCaptureAllowed("none", "pendente")).not.toThrow();
    expect(() => assertCaptureAllowed("none", "recusado")).not.toThrow();
  });

  it("captura real ('bot_online'/'local_mic') passa com consentimento 'dado'", () => {
    expect(() => assertCaptureAllowed("bot_online", "dado")).not.toThrow();
    expect(() => assertCaptureAllowed("local_mic", "dado")).not.toThrow();
  });

  it("recusa captura real sem consentimento (pendente/recusado/ausente)", () => {
    expect(() => assertCaptureAllowed("bot_online", "pendente")).toThrow(ConsentNotGrantedError);
    expect(() => assertCaptureAllowed("local_mic", "recusado")).toThrow(ConsentNotGrantedError);
    expect(() => assertCaptureAllowed("bot_online", null)).toThrow(ConsentNotGrantedError);
  });

  it("o erro carrega o consent_status observado (auditável)", () => {
    try {
      assertCaptureAllowed("bot_online", "pendente");
      expect.unreachable("devia ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(ConsentNotGrantedError);
      expect((e as ConsentNotGrantedError).consentStatus).toBe("pendente");
    }
  });

  it("isRealCapture distingue captura real de 'none'", () => {
    expect(isRealCapture("bot_online")).toBe(true);
    expect(isRealCapture("local_mic")).toBe(true);
    expect(isRealCapture("none")).toBe(false);
  });
});
