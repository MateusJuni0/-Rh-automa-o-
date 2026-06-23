import { describe, expect, it } from "vitest";
import {
  buildCompareHref,
  MAX_COMPARE,
  sameSelection,
  toggleCompareSelection,
} from "../lib/comparar-select";

describe("comparar-select — toggleCompareSelection", () => {
  it("acrescenta um id ausente (abaixo do limite)", () => {
    expect(toggleCompareSelection(["a"], "b")).toEqual(["a", "b"]);
  });

  it("remove um id presente", () => {
    expect(toggleCompareSelection(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("no limite, ignora um id novo (não passa do máximo)", () => {
    const cheio = ["a", "b", "c", "d"];
    expect(toggleCompareSelection(cheio, "e", MAX_COMPARE)).toEqual(cheio);
  });

  it("no limite, ainda remove um já selecionado", () => {
    const cheio = ["a", "b", "c", "d"];
    expect(toggleCompareSelection(cheio, "c", MAX_COMPARE)).toEqual(["a", "b", "d"]);
  });

  it("é imutável (não muta o array de entrada)", () => {
    const original = ["a", "b"];
    toggleCompareSelection(original, "c");
    expect(original).toEqual(["a", "b"]);
  });
});

describe("comparar-select — buildCompareHref", () => {
  it("inclui job + c separado por vírgulas", () => {
    expect(buildCompareHref("job1", ["a", "b"])).toBe("/comparar?job=job1&c=a,b");
  });

  it("seleção vazia → só o job (cai no defeito)", () => {
    expect(buildCompareHref("job1", [])).toBe("/comparar?job=job1");
  });

  it("ignora ids falsy", () => {
    expect(buildCompareHref("job1", ["a", "", "b"])).toBe("/comparar?job=job1&c=a,b");
  });
});

describe("comparar-select — sameSelection", () => {
  it("igual independentemente da ordem", () => {
    expect(sameSelection(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("diferente quando muda um id", () => {
    expect(sameSelection(["a", "b"], ["a", "c"])).toBe(false);
  });

  it("diferente quando muda o tamanho", () => {
    expect(sameSelection(["a"], ["a", "b"])).toBe(false);
  });
});
