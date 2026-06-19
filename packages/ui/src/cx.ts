/** Junta classes ignorando valores falsy. Sem dependências. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
