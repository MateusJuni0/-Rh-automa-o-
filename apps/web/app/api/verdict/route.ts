import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { registarVerdict } from "@/lib/verdict";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  processId: z.uuid(),
  verdict: z.enum(["approved", "rejected", "pending"]),
  reason: z.string().optional(),
  reasonType: z.string().optional(),
  botPredicted: z.enum(["strong", "ok", "weak"]).optional(),
  rubricVersion: z.number().int().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "campos inválidos"), { status: 400 });
  }
  const { agencyId } = await getSession();
  const res = await registarVerdict(getDb(), agencyId, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
