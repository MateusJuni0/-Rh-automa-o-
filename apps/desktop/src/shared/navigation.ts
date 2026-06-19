/**
 * Allowlist de navegação do renderer (APP-DESKTOP §10: `will-navigate` + `setWindowOpenHandler`).
 * Só o próprio app empacotado (`file:`) e as origens explícitas do backend Vera. Tudo o resto: negar.
 * Defesa contra navegação induzida (XSS → exfiltração/RCE).
 */

/**
 * True se o renderer pode navegar para `rawUrl` dadas as origens permitidas.
 * `file:` (o app empacotado) é permitido; usar só em `will-navigate` (não em open-window
 * para ficheiros locais arbitrários). `blob:`/`data:`/`javascript:` são sempre negados
 * (podem carregar conteúdo arbitrário construído no renderer, mesmo com origem de confiança).
 */
export function isAllowedNavigationUrl(rawUrl: string, allowedOrigins: readonly string[]): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol === "blob:" || url.protocol === "data:") {
    return false;
  }
  if (url.protocol === "file:") {
    return true;
  }
  return allowedOrigins.includes(url.origin);
}
