import { describe, expect, it } from "vitest";
import { averageColor, rgbCss } from "../lib/face-capture";

describe("averageColor", () => {
  it("média de pixels RGBA → cor dominante", () => {
    // 2 pixels: vermelho puro + preto → média (128,0,0).
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]);
    expect(averageColor(rgba)).toEqual([128, 0, 0]);
  });
  it("buffer vazio → preto (defensivo)", () => {
    expect(averageColor(new Uint8ClampedArray([]))).toEqual([0, 0, 0]);
  });
});

describe("rgbCss", () => {
  it("triplo → rgb()", () => {
    expect(rgbCss([255, 128, 0])).toBe("rgb(255, 128, 0)");
  });
});
