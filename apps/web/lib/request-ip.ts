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
