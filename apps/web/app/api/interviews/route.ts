import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createInterview } from "@/lib/interviews";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ processId: z.uuid().optional() });

/** POST /api/interviews — inicia entrevista → devolve {interviewId, room, token} (sala/token MOCK). */
export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(err("validation", "processId inválido (uuid)"), { status: 400 });
  }
  const { agencyId, recruiterId } = await getSession();
  const res = await createInterview(getDb(), agencyId, {
    recruiterId,
    processId: parsed.data.processId ?? null,
  });
  return Response.json(ok(res), { status: 201 });
}
