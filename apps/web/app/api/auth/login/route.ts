import { err, ok } from "@rh/core";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyMockLogin } from "@/lib/auth";
import { createLoginRateLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { AUTH_ENABLED, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

/**
 * Rate-limiter partilhado do login (in-memory, por-processo). Único por módulo → o estado persiste
 * entre pedidos enquanto o processo vive. PRODUÇÃO multi-instância: trocar por um store partilhado
 * (Redis) com a mesma interface — ver nota em `lib/rate-limit.ts`.
 */
const loginRateLimiter = createLoginRateLimiter();

/** Chaves de rate-limit: por-IP (varredura de contas) + por-IP+email (brute-force de 1 conta). */
function rateLimitKeys(ip: string, email?: string): string[] {
  const keys = [`ip:${ip}`];
  if (email) {
    keys.push(`ip+email:${ip}|${email.trim().toLowerCase()}`);
  }
  return keys;
}

/** Bloqueado se QUALQUER chave (IP ou IP+email) estiver em lockout. Retry-After = o maior restante. */
function rateLimited(keys: string[]): number | null {
  let retryAfter = 0;
  for (const key of keys) {
    const d = loginRateLimiter.check(key);
    if (!d.allowed) {
      retryAfter = Math.max(retryAfter, d.retryAfterSeconds);
    }
  }
  return retryAfter > 0 ? retryAfter : null;
}

/**
 * POST /api/auth/login — config-not-code:
 * - com Supabase Auth: `signInWithPassword` REAL (o cliente SSR escreve os cookies de sessão).
 * - sem env: login MOCK (email seed + password não-vazia) → cookies `vera_*` (shim v1).
 * Nunca devolve detalhe do erro do Supabase (evita leak); 401 uniforme em credenciais inválidas.
 * Rate-limit por IP+email (token-bucket + lockout) protege contra brute-force; 429 + Retry-After.
 */
export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req);
  // Pré-check só por IP (ainda não sabemos o email) — bloqueia varredura mesmo com body malformado.
  const ipKeys = rateLimitKeys(ip);
  const ipRetry = rateLimited(ipKeys);
  if (ipRetry !== null) {
    return tooManyRequests(ipRetry);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Pedido malformado conta como falha (por-IP) → trava scripts que nem sequer mandam JSON válido.
    for (const key of ipKeys) {
      loginRateLimiter.recordFailure(key);
    }
    return Response.json(err("validation", "email e password obrigatórios"), { status: 400 });
  }

  // Agora temos o email → checa também a chave IP+email antes de tentar autenticar.
  const keys = rateLimitKeys(ip, parsed.data.email);
  const retry = rateLimited(keys);
  if (retry !== null) {
    return tooManyRequests(retry);
  }

  if (AUTH_ENABLED) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error || !data.user) {
      recordFailure(keys);
      return Response.json(err("unauthorized", "credenciais inválidas"), { status: 401 });
    }
    recordSuccess(keys);
    return Response.json(ok({ name: data.user.email ?? "" }), { status: 200 });
  }

  const user = verifyMockLogin(parsed.data);
  if (!user) {
    recordFailure(keys);
    return Response.json(err("unauthorized", "credenciais inválidas"), { status: 401 });
  }
  recordSuccess(keys);
  const jar = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60, // TTL 8h (a sessão expira; re-auth real = Supabase)
  };
  jar.set("vera_agency", user.agencyId, opts);
  jar.set("vera_recruiter", user.recruiterId, opts);
  return Response.json(ok({ name: user.name }), { status: 200 });
}

function recordFailure(keys: string[]): void {
  for (const key of keys) {
    loginRateLimiter.recordFailure(key);
  }
}

function recordSuccess(keys: string[]): void {
  for (const key of keys) {
    loginRateLimiter.recordSuccess(key);
  }
}

/**
 * 429 com envelope inline. `rate_limited` NÃO faz parte do enum congelado de `@rh/core` (não inventamos
 * códigos no protocolo) → construímos o envelope à mão, como o middleware faz no 401 do edge.
 */
function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    {
      ok: false,
      error: { code: "rate_limited", message: "demasiadas tentativas; tente mais tarde" },
    },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}
