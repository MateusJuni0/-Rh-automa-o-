/**
 * Allowlist de navegação do renderer (APP-DESKTOP §10: `will-navigate` + `setWindowOpenHandler`).
 * Só o próprio app empacotado (`file:`) e as origens explícitas do backend Vera. Tudo o resto: negar.
 * Defesa contra navegação induzida (XSS → exfiltração/RCE).
 */

/** Esquemas SEMPRE negados (carregam conteúdo arbitrário do renderer, mesmo com origem de confiança). */
const DENIED_PROTOCOLS: ReadonlySet<string> = new Set(["blob:", "data:", "javascript:"]);

/**
 * True se o renderer pode navegar para `rawUrl` dadas as origens permitidas.
 * `file:` (o app empacotado) é permitido; usar só em `will-navigate`/`will-redirect` (não em
 * open-window para ficheiros locais arbitrários). Os esquemas em `DENIED_PROTOCOLS` são negados.
 */
export function isAllowedNavigationUrl(rawUrl: string, allowedOrigins: readonly string[]): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (DENIED_PROTOCOLS.has(url.protocol)) {
    return false;
  }
  if (url.protocol === "file:") {
    return true;
  }
  return allowedOrigins.includes(url.origin);
}
