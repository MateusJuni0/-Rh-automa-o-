export interface SessionCookies {
  agencyId: string;
  recruiterId: string;
}

/**
 * Lê a sessão a partir de um getter de cookies (puro/testável — sem `next/headers`). Exige AMBOS
 * os cookies de sessão; senão `null` (→ o middleware responde 401 nas /api / redireciona páginas).
 */
export function sessionFromCookies(
  get: (name: string) => string | undefined,
): SessionCookies | null {
  const agencyId = get("vera_agency");
  const recruiterId = get("vera_recruiter");
  if (!agencyId || !recruiterId) {
    return null;
  }
  return { agencyId, recruiterId };
}
