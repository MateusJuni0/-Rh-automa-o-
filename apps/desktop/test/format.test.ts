import { describe, expect, it } from "vitest";
import { coverageCount, formatElapsed } from "../src/renderer/hud/format";

describe("formatElapsed", () => {
  it("formata mm:ss com zero-padding e clamp a 0", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(75_000)).toBe("01:15");
    expect(formatElapsed(featured(12, 34))).toBe("12:34");
    expect(formatElapsed(-5)).toBe("00:00");
  });
});

function featured(min: number, sec: number): number {
  return (min * 60 + sec) * 1000;
}

describe("coverageCount", () => {
  it("conta cobertos vs total", () => {
    expect(
      coverageCount([
        { status: "coberto-com-prova" },
        { status: "raso" },
        { status: "coberto-com-prova" },
      ]),
    ).toEqual({ done: 2, total: 3 });
    expect(coverageCount([])).toEqual({ done: 0, total: 0 });
  });
});
