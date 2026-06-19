import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ingerirMensagem } from "@/lib/intake";
import { getSession } from "@/lib/session";

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
  const { agencyId } = await getSession();
  const res = await ingerirMensagem(getDb(), agencyId, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
