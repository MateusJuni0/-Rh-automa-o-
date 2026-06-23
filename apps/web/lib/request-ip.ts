/** A ligação é HTTPS? Deriva de `x-forwarded-proto` (atrás de proxy) ou do protocolo do URL. É o que
 * decide a flag `secure` dos cookies (NÃO inferir de NODE_ENV — um dev em HTTPS quer secure; um prod
 * mal-configurado em HTTP não deve marcar secure e perder o cookie). */
export function isHttps(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (proto) {
    return proto === "https";
  }
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Extrai o IP do cliente de um Request, à frente de proxies (Vercel/NGINX). Sem header → "unknown"
 * (todos os pedidos sem IP partilham o mesmo balde — fail-safe conservador, não permissivo). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // O 1.º da lista é o cliente original; o resto são proxies.
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) {
    return real;
  }
  return "unknown";
}
