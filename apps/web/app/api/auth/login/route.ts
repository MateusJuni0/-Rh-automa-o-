import { err, ok } from "@rh/core";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyMockLogin } from "@/lib/auth";
import { AUTH_ENABLED, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

/**
 * POST /api/auth/login — config-not-code:
 * - com Supabase Auth: `signInWithPassword` REAL (o cliente SSR escreve os cookies de sessão).
 * - sem env: login MOCK (email seed + password não-vazia) → cookies `vera_*` (shim v1).
 * Nunca devolve detalhe do erro do Supabase (evita leak); 401 uniforme em credenciais inválidas.
 */
export async function POST(req: Request): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "email e password obrigatórios"), { status: 400 });
  }

  if (AUTH_ENABLED) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error || !data.user) {
      return Response.json(err("unauthorized", "credenciais inválidas"), { status: 401 });
    }
    return Response.json(ok({ name: data.user.email ?? "" }), { status: 200 });
  }

  const user = verifyMockLogin(parsed.data);
  if (!user) {
    return Response.json(err("unauthorized", "credenciais inválidas"), { status: 401 });
  }
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
