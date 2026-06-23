import { describe, expect, it } from "vitest";
import { verifyMockLogin } from "../lib/auth";

describe("verifyMockLogin (login mock)", () => {
  it("aceita email seed + password não-vazia → utilizador", () => {
    const u = verifyMockLogin({ email: "filipa@iris.tech", password: "demo" });
    expect(u?.name).toBe("Filipa");
    expect(u?.recruiterId).toBeTruthy();
  });

  it("email case/space-insensitive", () => {
    expect(verifyMockLogin({ email: "  FILIPA@iris.tech ", password: "x" })?.name).toBe("Filipa");
  });

  it("rejeita email desconhecido", () => {
    expect(verifyMockLogin({ email: "estranho@x.pt", password: "x" })).toBeNull();
  });

  it("rejeita password vazia", () => {
    expect(verifyMockLogin({ email: "filipa@iris.tech", password: "" })).toBeNull();
  });
});
