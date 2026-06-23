/** Cronómetro mm:ss a partir de milissegundos decorridos (clamp a 0). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Contagem coberto/total para o "8/12" da pílula. */
export function coverageCount(requisitos: ReadonlyArray<{ status: string }>): {
  done: number;
  total: number;
} {
  const done = requisitos.filter((r) => r.status === "coberto-com-prova").length;
  return { done, total: requisitos.length };
}
