import { type NextRequest, NextResponse } from "next/server";

/**
 * Gate de páginas: sem sessão (cookie `vera_recruiter`) → redireciona para /login. Só páginas
 * (o matcher exclui /api e estáticos). A proteção/401 uniforme das rotas /api é a fatia N2.
 */
export function middleware(req: NextRequest): NextResponse {
  const isLogin = req.nextUrl.pathname.startsWith("/login");
  const hasSession = req.cookies.has("vera_recruiter");
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
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
