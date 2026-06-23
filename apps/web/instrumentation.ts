/**
 * Hook de arranque do Next (chamado uma vez quando o servidor sobe). Validamos aqui os invariantes
 * de config de auth (fail-fast): config meia-feita ou produção sem auth nem escape-hatch → o processo
 * não arranca, em vez de servir silenciosamente em modo mock. Só corre no runtime Node (não edge).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertAuthConfig } = await import("./lib/auth-config");
    assertAuthConfig();
  }
}
