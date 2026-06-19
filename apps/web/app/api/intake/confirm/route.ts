import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { confirmarIntake } from "@/lib/intake";
import { getSession } from "@/lib/session";

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
  const { agencyId } = await getSession();
  const res = await confirmarIntake(getDb(), agencyId, parsed.data);
  return Response.json(ok(res), { status: 200 });
}
