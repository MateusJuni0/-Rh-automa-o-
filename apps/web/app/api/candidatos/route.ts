import { err, ok } from "@rh/core";
import { z } from "zod";
import { createCandidato, listCandidatos } from "@/lib/candidatos";
import { DEV_AGENCY_ID, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(ok(await listCandidatos(getDb(), DEV_AGENCY_ID)));
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
  const res = await createCandidato(getDb(), DEV_AGENCY_ID, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
