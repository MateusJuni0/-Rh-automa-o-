import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { destilarFacto } from "@/lib/destilar";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  candidateId: z.uuid(),
  processId: z.uuid().optional(),
  competencia: z.string().min(1),
  factText: z.string().min(1),
  evidenceQuote: z.string().optional(),
  evidenceTs: z.string().optional(),
  speaker: z.string().optional(),
  rubricLevel: z.enum(["fraco", "ok", "forte"]).optional(),
  requisitoId: z.uuid().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "campos inválidos"), { status: 400 });
  }
  const { agencyId } = await getSession();
  const res = await destilarFacto(getDb(), agencyId, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
