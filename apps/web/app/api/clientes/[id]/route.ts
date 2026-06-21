import { err, ok } from "@rh/core";
import { z } from "zod";
import { updateCliente } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  sector: z.string().nullish(),
  website: z.string().nullish(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  founded: z.string().nullish(),
  headcount: z.string().nullish(),
  linkedinUrl: z.string().nullish(),
  techStack: z.array(z.string()).nullish(),
});

/** PATCH /api/clientes/:id — a Filipa atualiza a ficha do cliente. Predicado por agência. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "dados inválidos"), { status: 400 });
  }
  const { agencyId } = await getSession();
  await updateCliente(getDb(), agencyId, id, parsed.data);
  return Response.json(ok({ id }));
}
