/**
 * Lógica pura da seleção do Comparar (Tela 10): client-safe (sem DB, sem React) para poder ser
 * importada pelo componente cliente E pelo `comparar.ts` do servidor sem arrastar `pg` para o bundle.
 * Mesmo padrão do `parecer-view.ts`.
 */

/** Máximo de candidatos por matriz: 4 colunas ainda lêem-se lado a lado no escuro. */
export const MAX_COMPARE = 4;

/** Candidato escolhível no selector (subconjunto da triagem: o que o selector precisa de mostrar). */
export interface SelectableCandidate {
  candidateId: string;
  name: string;
  matchScore: number;
}

/**
 * Alterna `id` em `selected`, de forma imutável e respeitando `max`:
 * - presente → remove;
 * - ausente e abaixo do limite → acrescenta (no fim, preservando a ordem);
 * - ausente e no/acima do limite → devolve igual (o UI deve impedir este caso desativando o toggle).
 */
export function toggleCompareSelection(
  selected: readonly string[],
  id: string,
  max: number = MAX_COMPARE,
): string[] {
  if (selected.includes(id)) {
    return selected.filter((s) => s !== id);
  }
  if (selected.length >= max) {
    return [...selected];
  }
  return [...selected, id];
}

/**
 * Constrói o href do Comparar para `job` + `selected`. Seleção vazia → sem `c` (a página cai no
 * comportamento por defeito: os primeiros candidatos por match). `c` mantém o contrato existente:
 * lista separada por vírgulas (`?job=…&c=id1,id2`).
 */
export function buildCompareHref(job: string, selected: readonly string[]): string {
  const ids = selected.filter(Boolean);
  const base = `/comparar?job=${encodeURIComponent(job)}`;
  if (ids.length === 0) {
    return base;
  }
  return `${base}&c=${ids.map(encodeURIComponent).join(",")}`;
}

/** `true` se os dois conjuntos de ids são iguais (ordem-independente) — para saber se a seleção mudou. */
export function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}
