import { describe, expect, it } from "vitest";
import { MEMORY_FACT_KINDS } from "../lib/assistant/memory";
import { ONBOARDING_QUESTIONS } from "../lib/onboarding";

describe("onboarding — perguntas (Tela 11)", () => {
  it("tem perguntas e todas com kind válido + prompt + id + placeholder", () => {
    expect(ONBOARDING_QUESTIONS.length).toBeGreaterThanOrEqual(5);
    for (const q of ONBOARDING_QUESTIONS) {
      expect(MEMORY_FACT_KINDS).toContain(q.kind);
      expect(q.prompt.length).toBeGreaterThan(5);
      expect(q.id.length).toBeGreaterThan(0);
      expect(q.placeholder.length).toBeGreaterThan(0);
    }
  });

  it("ids únicos (sourceRef estável)", () => {
    const ids = ONBOARDING_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cobre vários tipos (estilo + preferência), não é só um", () => {
    const kinds = new Set(ONBOARDING_QUESTIONS.map((q) => q.kind));
    expect(kinds.has("style")).toBe(true);
    expect(kinds.has("preference")).toBe(true);
  });
});
