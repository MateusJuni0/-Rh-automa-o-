import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createVaga, listVagas } from "@/lib/vagas";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { agencyId } = await getSession();
  return Response.json(ok(await listVagas(getDb(), agencyId)));
}

const bodySchema = z.object({
  clientId: z.uuid(),
  title: z.string().min(1),
  roleTypeSlug: z.string().optional(),
  requirementsText: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "clientId, title e requirementsText são obrigatórios"), {
      status: 400,
    });
  }
  const { agencyId, recruiterId } = await getSession();
  const res = await createVaga(getDb(), agencyId, parsed.data, recruiterId);
  return Response.json(ok(res), { status: 201 });
}
