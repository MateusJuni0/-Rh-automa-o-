import { err, ok } from "@rh/core";
import { z } from "zod";
import { DEV_AGENCY_ID, getDb } from "@/lib/db";
import { confirmarIntake } from "@/lib/intake";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  messageId: z.uuid(),
  name: z.string().min(1).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "messageId é obrigatório"), { status: 400 });
  }
  const res = await confirmarIntake(getDb(), DEV_AGENCY_ID, parsed.data);
  return Response.json(ok(res), { status: 200 });
}
