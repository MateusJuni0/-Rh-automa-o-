import { err, ok } from "@rh/core";
import { z } from "zod";
import { DEV_AGENCY_ID, getDb } from "@/lib/db";
import { matchCandidatoVaga } from "@/lib/match";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ candidateId: z.uuid(), jobId: z.uuid() });

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "candidateId e jobId são obrigatórios"), {
      status: 400,
    });
  }
  const res = await matchCandidatoVaga(getDb(), DEV_AGENCY_ID, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
