import { err, ok } from "@rh/core";
import { z } from "zod";
import { createCandidato, listCandidatos } from "@/lib/candidatos";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { agencyId } = await getSession();
  return Response.json(ok(await listCandidatos(getDb(), agencyId)));
}

const bodySchema = z.object({
  name: z.string().min(1),
  linkedinUrl: z.string().optional(),
  cvText: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "name e cvText são obrigatórios"), { status: 400 });
  }
  const { agencyId } = await getSession();
  const res = await createCandidato(getDb(), agencyId, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
