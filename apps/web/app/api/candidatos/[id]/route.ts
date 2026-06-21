import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { purgeCandidate } from "@/lib/rgpd";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Apagar é IRREVERSÍVEL → exige `confirm:true` explícito (porta de segurança, AUTH-CONTRACT §4). */
const bodySchema = z.object({ confirm: z.literal(true) });

/**
 * DELETE /api/candidatos/:id — direito ao esquecimento (RGPD Art.17, DATA-RETENTION §3).
 * ANONIMIZA o candidato em cascata (apaga a PII, preserva o ground-truth da calibração sem PII),
 * numa transação isolada por agência (`purgeCandidate`, DATA-RETENTION §3.2/§6).
 * IRREVERSÍVEL: só corre com `{ confirm: true }` no corpo.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json(err("validation", "id inválido"), { status: 400 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "apagar é irreversível — envia { confirm: true }"), {
      status: 400,
    });
  }
  const { agencyId } = await getSession();
  const summary = await purgeCandidate(getDb(), agencyId, id);
  if (!summary.anonymized) {
    return Response.json(err("not_found", "candidato não encontrado nesta agência"), {
      status: 404,
    });
  }
  return Response.json(ok(summary), { status: 200 });
}
