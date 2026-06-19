import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { matchCandidatoVaga } from "@/lib/match";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ candidateId: z.uuid(), jobId: z.uuid() });

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "candidateId e jobId são obrigatórios"), {
      status: 400,
    });
  }
  const { agencyId } = await getSession();
  const res = await matchCandidatoVaga(getDb(), agencyId, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
