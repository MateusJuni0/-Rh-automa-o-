import { describe, expect, it } from "vitest";
import { sessionFromCookies } from "../lib/api";

const getter = (jar: Record<string, string>) => (name: string) => jar[name];

describe("sessionFromCookies (gate de sessão, puro)", () => {
  it("ambos os cookies → sessão", () => {
    const s = sessionFromCookies(getter({ vera_agency: "ag1", vera_recruiter: "rec1" }));
    expect(s).toEqual({ agencyId: "ag1", recruiterId: "rec1" });
  });

  it("falta o recruiter → null", () => {
    expect(sessionFromCookies(getter({ vera_agency: "ag1" }))).toBeNull();
  });

  it("falta a agência → null", () => {
    expect(sessionFromCookies(getter({ vera_recruiter: "rec1" }))).toBeNull();
  });

  it("sem cookies → null", () => {
    expect(sessionFromCookies(() => undefined)).toBeNull();
  });
});
