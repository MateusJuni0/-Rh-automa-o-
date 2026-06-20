import { err, ok } from "@rh/core";
import { cookies } from "next/headers";
import { z } from "zod";
import { INES_RECRUITER_ID } from "@/lib/auth";
import { DEV_AGENCY_ID } from "@/lib/db";
import { getFaceClient } from "@/lib/face-config";
import { DEV_RECRUITER_ID } from "@/lib/vagas";

export const dynamic = "force-dynamic";

const rgb = z.tuple([z.number(), z.number(), z.number()]);
const schema = z.object({
  email: z.email(),
  token: z.string().min(1),
  frames: z.array(z.object({ imageB64: z.string(), measuredColor: rgb })).min(1),
});

/** email seed → recruiter (single-tenant IRIS). O `user_id` da biometria é o email. */
const SEED: Record<string, string> = {
  "filipa@iris.tech": DEV_RECRUITER_ID,
  "ines@iris.tech": INES_RECRUITER_ID,
};

/**
 * POST /api/auth/face — login por biometria. Verifica o rosto no serviço face (liveness + match);
 * só com `match && liveness_ok` cria a sessão. Falha → 401 uniforme (sem leak do motivo do serviço).
 */
export async function POST(req: Request): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "pedido de biometria inválido"), { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const recruiterId = SEED[email];
  if (!recruiterId) {
    return Response.json(err("unauthorized", "biometria não reconhecida"), { status: 401 });
  }

  const face = getFaceClient();
  let result: Awaited<ReturnType<typeof face.verify>>;
  try {
    result = await face.verify(email, parsed.data.token, parsed.data.frames);
  } catch {
    return Response.json(err("unauthorized", "biometria indisponível"), { status: 401 });
  }
  if (!result.match || !result.liveness_ok) {
    return Response.json(err("unauthorized", "biometria não reconhecida"), { status: 401 });
  }

  const jar = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60,
  };
  jar.set("vera_agency", DEV_AGENCY_ID, opts);
  jar.set("vera_recruiter", recruiterId, opts);
  return Response.json(ok({ recruiterId }), { status: 200 });
}
