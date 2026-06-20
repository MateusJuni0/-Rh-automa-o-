import { type NextRequest, NextResponse } from "next/server";
import { sessionFromCookies } from "@/lib/api";
import { AUTH_ENABLED } from "@/lib/supabase/server";

// /api públicas (sem sessão): login (email/senha) e health. Logout exige sessão.
function isPublicApi(pathname: string): boolean {
  return pathname === "/api/health" || pathname === "/api/auth/login";
}

/**
 * Resolve "há sessão?" + a `response` a devolver (com a rotação de cookies do Supabase, se ligado).
 * config-not-code: com `AUTH_ENABLED` → user do Supabase (JWT nos cookies); senão → shim de cookie.
 */
async function resolveSession(
  req: NextRequest,
): Promise<{ hasSession: boolean; response: NextResponse }> {
  if (AUTH_ENABLED) {
    const { getSupabaseUserForMiddleware } = await import("@/lib/supabase/middleware");
    const { userId, response } = await getSupabaseUserForMiddleware(req);
    return { hasSession: Boolean(userId), response };
  }
  const session = sessionFromCookies((n) => req.cookies.get(n)?.value);
  return { hasSession: Boolean(session), response: NextResponse.next() };
}

/**
 * Gate único: páginas sem sessão → redirect /login; /api sem sessão → **401 uniforme** (envelope
 * @rh/core inline — evita importar @rh/core no edge runtime). As rotas continuam a obter a
 * identidade via getSession (nunca do cliente); isto é a defesa na fronteira.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const { hasSession, response } = await resolveSession(req);

  if (pathname.startsWith("/api")) {
    if (hasSession || isPublicApi(pathname)) {
      return response;
    }
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "sessão necessária" } },
      { status: 401 },
    );
  }

  const isLogin = pathname.startsWith("/login");
  if (!hasSession && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
