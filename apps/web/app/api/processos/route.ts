import { randomUUID } from "node:crypto";
import { err, ok } from "@rh/core";
import { schema } from "@rh/db";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid(),
});

/** POST /api/processos — adiciona candidato ao funil de uma vaga (cria process). Idempotente. */
export async function POST(req: Request): Promise<Response> {
  const { agencyId, recruiterId } = await getSession();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "candidateId e jobId são obrigatórios"), {
      status: 400,
    });
  }
  const { candidateId, jobId } = parsed.data;
  const id = randomUUID();
  await getDb()
    .insert(schema.process)
    .values({ id, agencyId, candidateId, jobId, recruiterId, stage: "sourced" })
    .onConflictDoNothing();
  return Response.json(ok({ id }), { status: 201 });
}
