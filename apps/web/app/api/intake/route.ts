import { err, ok } from "@rh/core";
import { z } from "zod";
import { DEV_AGENCY_ID, getDb } from "@/lib/db";
import { ingerirMensagem } from "@/lib/intake";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  source: z.enum(["telegram", "web_upload", "email"]),
  text: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "source e text são obrigatórios"), { status: 400 });
  }
  const res = await ingerirMensagem(getDb(), DEV_AGENCY_ID, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
