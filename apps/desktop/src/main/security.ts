import { buildCsp } from "../shared/csp";
import { isAllowedNavigationUrl } from "../shared/navigation";

/**
 * Decisões puras do hardening do main (APP-DESKTOP §10). O `main.ts` aplica-as aos
 * objetos reais do Electron (webContents/session) — aqui fica a lógica testável.
 */

export { buildCsp };

/** Permitir/negar uma navegação induzida no renderer (will-navigate). */
export function navigationDecision(
  url: string,
  allowedOrigins: readonly string[],
): "allow" | "deny" {
  return isAllowedNavigationUrl(url, allowedOrigins) ? "allow" : "deny";
}

/** Injeta a CSP nos response headers (substitui qualquer CSP anterior; case-insensitive). */
export function withCspHeader(
  headers: Record<string, string[] | string | undefined>,
  csp: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "content-security-policy" || value === undefined) {
      continue;
    }
    next[key] = Array.isArray(value) ? value : [value];
  }
  next["Content-Security-Policy"] = [csp];
  return next;
}
