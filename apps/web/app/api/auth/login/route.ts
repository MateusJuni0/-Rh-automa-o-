import { err, ok } from "@rh/core";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyMockLogin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

/** POST /api/auth/login — login MOCK: valida → set cookies de sessão (lidos pelo getSession). */
export async function POST(req: Request): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "email e password obrigatórios"), { status: 400 });
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
    maxAge: 8 * 60 * 60, // TTL 8h (a sessão expira; re-auth real = Supabase Ω)
  };
  jar.set("vera_agency", user.agencyId, opts);
  jar.set("vera_recruiter", user.recruiterId, opts);
  return Response.json(ok({ name: user.name }), { status: 200 });
}
