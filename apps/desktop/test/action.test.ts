import { describe, expect, it } from "vitest";
import { veraAction } from "../src/shared/action";

describe("veraAction (validação IPC)", () => {
  it("aceita ações válidas", () => {
    expect(veraAction.safeParse({ kind: "usei" }).success).toBe(true);
    expect(veraAction.safeParse({ kind: "chat", text: "olá" }).success).toBe(true);
  });

  it("rejeita kind desconhecido e texto demasiado longo", () => {
    expect(veraAction.safeParse({ kind: "rm-rf" }).success).toBe(false);
    expect(veraAction.safeParse({ kind: "chat", text: "x".repeat(2001) }).success).toBe(false);
    expect(veraAction.safeParse("nope").success).toBe(false);
  });
});
