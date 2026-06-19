import { err, ok } from "@rh/core";
import { z } from "zod";
import { generateBriefing } from "@/lib/briefing";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ jobId: z.uuid() });

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "jobId é obrigatório"), { status: 400 });
  }
  const { agencyId } = await getSession();
  const res = await generateBriefing(getDb(), agencyId, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
