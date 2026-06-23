import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Cliente Supabase para o middleware (edge). Liga-se aos cookies do `NextRequest` e propaga a
 * rotação de cookies para a `NextResponse` devolvida. Devolve `{ user, response }` — o middleware
 * usa `user` para decidir o gate e DEVE devolver a `response` (para o refresh do token persistir).
 */
export async function getSupabaseUserForMiddleware(
  req: NextRequest,
): Promise<{ userId: string | null; response: NextResponse }> {
  let response = NextResponse.next({ request: req });
  const url = process.env.SUPABASE_URL ?? "";
  const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
  // fetch com timeout de 6s — evita que o middleware trave indefinidamente se o GoTrue local
  // estiver down (ex.: Docker não iniciado). Falha rápida → redireciona para /login em vez de congelar.
  const timeoutFetch: typeof fetch = (input, init) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 6000);
    return fetch(input, { ...init, signal: ac.signal }).finally(() => clearTimeout(t));
  };
  const supabase = createServerClient(url, anonKey, {
    global: { fetch: timeoutFetch },
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet: CookieToSet[]) => {
        for (const { name, value } of toSet) {
          req.cookies.set(name, value);
        }
        response = NextResponse.next({ request: req });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Timeout ou GoTrue inacessível — trata como não-autenticado (redireciona para /login).
    user = null;
  }
  return { userId: user?.id ?? null, response };
}
