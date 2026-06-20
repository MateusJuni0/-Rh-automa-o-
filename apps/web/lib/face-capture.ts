/**
 * Helpers PUROS da captura de flash liveness no browser (sem DOM → testáveis). A página de login
 * usa-os com `getUserMedia` + `<canvas>` reais; aqui só fica a matemática (cor dominante média).
 */

/** Cor dominante (média) de um buffer RGBA (ImageData.data). Arredonda a inteiros 0-255. */
export function averageColor(rgba: Uint8ClampedArray): [number, number, number] {
  if (rgba.length < 4) {
    return [0, 0, 0];
  }
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = Math.floor(rgba.length / 4);
  for (let i = 0; i < rgba.length; i += 4) {
    r += rgba[i] ?? 0;
    g += rgba[i + 1] ?? 0;
    b += rgba[i + 2] ?? 0;
  }
  return [Math.round(r / pixels), Math.round(g / pixels), Math.round(b / pixels)];
}

/** CSS rgb() a partir de um triplo (para pintar o ecrã com a cor do flash). */
export function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}
