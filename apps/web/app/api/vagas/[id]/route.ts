import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jobDetails } from "@/lib/vaga-details";
import { updateVagaDetails } from "@/lib/vagas";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ details: jobDetails });

/** PATCH /api/vagas/:id — a Filipa completa/atualiza a ficha da vaga. Predicado por agência. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "dados inválidos"), { status: 400 });
  }
  const { agencyId } = await getSession();
  await updateVagaDetails(getDb(), agencyId, id, parsed.data.details);
  return Response.json(ok({ id }));
}
