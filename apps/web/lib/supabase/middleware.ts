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
  const supabase = createServerClient(url, anonKey, {
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { userId: user?.id ?? null, response };
}
