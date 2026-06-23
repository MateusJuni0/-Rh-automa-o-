import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Auth REAL ligada quando há URL + anon key do Supabase. Sem isto → shim de cookie (fallback v1). */
export const AUTH_ENABLED = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

/**
 * Cliente Supabase server-side (`@supabase/ssr`) ligado aos cookies do Next. Lê/escreve a sessão
 * (JWT do Supabase) nos cookies httpOnly. NUNCA usa a service-role key (essa é só do storage/seed).
 * Chamar só quando `AUTH_ENABLED` (senão as envs estão vazias e o cliente não serve).
 */
export async function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL ?? "";
  const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
  const jar = await cookies();
  // fetch com timeout de 8s — evita congelamento se GoTrue local estiver down.
  const timeoutFetch: typeof fetch = (input, init) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    return fetch(input, { ...init, signal: ac.signal }).finally(() => clearTimeout(t));
  };
  return createServerClient(url, anonKey, {
    global: { fetch: timeoutFetch },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (toSet: CookieToSet[]) => {
        // Em RSC o jar é read-only → ignora (o middleware faz o refresh dos cookies). Em route
        // handlers / server actions o set funciona. Try/catch evita rebentar no RSC.
        try {
          for (const { name, value, options } of toSet) {
            jar.set(name, value, options);
          }
        } catch {
          // read-only store (RSC) — o middleware trata da rotação dos cookies.
        }
      },
    },
  });
}
