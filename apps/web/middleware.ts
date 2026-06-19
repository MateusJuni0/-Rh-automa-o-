import { type NextRequest, NextResponse } from "next/server";
import { sessionFromCookies } from "@/lib/api";

// /api públicas (sem sessão): só login e health. Logout exige sessão (evita forced-logout).
function isPublicApi(pathname: string): boolean {
  return pathname === "/api/health" || pathname === "/api/auth/login";
}

/**
 * Gate único: páginas sem sessão → redirect /login; /api sem sessão → **401 uniforme** (envelope
 * @rh/core inline — evita importar @rh/core no edge runtime). As rotas continuam a obter a
 * identidade via getSession (nunca do cliente); isto é a defesa na fronteira.
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const session = sessionFromCookies((n) => req.cookies.get(n)?.value);

  if (pathname.startsWith("/api")) {
    if (session || isPublicApi(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "sessão necessária" } },
      { status: 401 },
    );
  }

  const isLogin = pathname.startsWith("/login");
  if (!session && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (session && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
