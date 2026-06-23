import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { InterviewNotFoundError, InvalidTransitionError, joinInterview } from "@/lib/interviews";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** POST /api/interviews/:id/join — garante sala/token (mock) + transita p/ 'live'. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json(err("validation", "id inválido"), { status: 400 });
  }
  const { agencyId } = await getSession();
  try {
    const res = await joinInterview(getDb(), agencyId, id);
    return Response.json(ok(res), { status: 200 });
  } catch (e) {
    if (e instanceof InterviewNotFoundError) {
      return Response.json(err("not_found", "entrevista inexistente"), { status: 404 });
    }
    if (e instanceof InvalidTransitionError) {
      return Response.json(err("conflict", "entrevista já terminada"), { status: 409 });
    }
    throw e;
  }
}
