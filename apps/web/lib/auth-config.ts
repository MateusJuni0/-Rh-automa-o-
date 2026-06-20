/**
 * Invariantes de configuração de auth — fail-fast no arranque (SEGURANÇA Ω). Evita o pior cenário:
 * config meia-feita que faz a app cair SILENCIOSAMENTE no modo mock pensando que tem auth real.
 *
 * Regras:
 * 1. Se UMA das envs de auth (`SUPABASE_URL` / `SUPABASE_ANON_KEY`) está presente, a OUTRA também
 *    tem de estar — config parcial = quase de certeza um erro de deploy (auth desligada sem querer).
 * 2. Em produção sem auth, exige a flag EXPLÍCITA `ALLOW_DEV_SESSION=1` — nunca correr produção em
 *    modo mock/cookie-shim por acidente (o default de NODE_ENV não chega como salvaguarda).
 */

/** Flag EXPLÍCITA que autoriza o fallback DEV de sessão (cookie-shim). Sem isto, prod sem auth aborta. */
export function devSessionAllowed(): boolean {
  return process.env.ALLOW_DEV_SESSION === "1" || process.env.ALLOW_DEV_SESSION === "true";
}

/** Lança se a config de auth for inconsistente/perigosa. Chamar no arranque (layout/entrypoint). */
export function assertAuthConfig(): void {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (url && !anonKey) {
    throw new Error(
      "auth config inválida: SUPABASE_URL definido mas SUPABASE_ANON_KEY em falta " +
        "(a auth cairia silenciosamente em modo mock). Define ambos ou nenhum.",
    );
  }
  if (anonKey && !url) {
    throw new Error(
      "auth config inválida: SUPABASE_ANON_KEY definido mas SUPABASE_URL em falta. " +
        "Define ambos ou nenhum.",
    );
  }

  const authEnabled = Boolean(url && anonKey);
  if (!authEnabled && process.env.NODE_ENV === "production" && !devSessionAllowed()) {
    throw new Error(
      "arranque abortado: produção sem Supabase Auth e sem ALLOW_DEV_SESSION=1. " +
        "Liga a auth real (SUPABASE_URL + SUPABASE_ANON_KEY) ou autoriza o fallback dev explicitamente.",
    );
  }
}
