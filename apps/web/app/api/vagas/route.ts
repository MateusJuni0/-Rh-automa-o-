import { err, ok } from "@rh/core";
import { z } from "zod";
import { DEV_AGENCY_ID, getDb } from "@/lib/db";
import { createVaga, listVagas } from "@/lib/vagas";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(ok(await listVagas(getDb(), DEV_AGENCY_ID)));
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
  const res = await createVaga(getDb(), DEV_AGENCY_ID, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
