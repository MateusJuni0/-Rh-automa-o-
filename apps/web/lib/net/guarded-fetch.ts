/**
 * Guard anti-SSRF reutilizável (SEGURANCA §2): o ÚNICO funil para egress HTTP server-side. Recusa
 * esquema não-http(s), localhost e IPs internos (RFC1918/loopback/link-local/metadata) — ANTES e
 * DEPOIS de CADA redirect (bloqueia o bypass clássico: URL público que faz 30x para um IP interno
 * tipo 169.254.169.254). Todo o fetch de URL não-confiável (import de vaga, pesquisa, fetch ao vivo)
 * deve passar por aqui. NOTA Ω: pinning de IP pós-DNS (anti DNS-rebinding total) entra com a infra.
 */

export class SsrfBlockedError extends Error {
  constructor(
    readonly url: string,
    readonly reason: string,
  ) {
    super(`egress bloqueado (SSRF): ${reason} — ${url}`);
    this.name = "SsrfBlockedError";
  }
}

/** Host (hostname OU IP literal) aponta para a rede interna/loopback/metadata? */
export function isInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // remove [] de IPv6
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    return true;
  }
  // IPv4: loopback 127/8, privados 10/8 e 192.168/16, link-local 169.254/16, 0.0.0.0/8
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) {
    return true;
  }
  // IPv4 privado 172.16/12
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return true;
  }
  // IPv6: loopback ::1, unspecified ::, link-local fe80::/10, ULA fc00::/7
  if (host === "::1" || host === "::" || host.startsWith("fe80") || /^f[cd]/.test(host)) {
    return true;
  }
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) → valida a parte v4
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1] && isInternalHost(mapped[1])) {
    return true;
  }
  return false;
}

/** Valida um URL para egress. Lança `SsrfBlockedError` se esquema/host não permitido. Devolve o URL. */
export function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfBlockedError(raw, "URL inválido");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new SsrfBlockedError(raw, "esquema não permitido (só http/https)");
  }
  if (isInternalHost(u.hostname)) {
    throw new SsrfBlockedError(raw, "host interno/loopback/metadata");
  }
  return u;
}

export interface GuardedFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

/**
 * Fetch com guarda anti-SSRF em CADA salto: `redirect:"manual"` + re-validação do `Location` antes de
 * o seguir (um redirect para IP interno é recusado). Lança `SsrfBlockedError` se algum salto for
 * inseguro ou houver redirects a mais.
 */
export async function guardedFetch(raw: string, opts: GuardedFetchOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxRedirects = opts.maxRedirects ?? 4;
  let url = assertSafeUrl(raw);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: opts.headers ?? {},
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        return res;
      }
      url = assertSafeUrl(new URL(loc, url).toString()); // re-valida o destino ANTES de seguir
      continue;
    }
    return res;
  }
  throw new SsrfBlockedError(raw, "demasiados redirects");
}
