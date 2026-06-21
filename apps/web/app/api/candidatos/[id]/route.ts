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
 * Purga em cascata TODA a PII do candidato, numa transação, isolada por agência (`purgeCandidate`).
 * IRREVERSÍVEL: só corre com `{ confirm: true }` no corpo.
 *
 * NOTA (#5b, DATA-RETENTION §3.2): a versão atual faz hard-delete também de `placement_outcome`/
 * `client_verdict` (ground-truth da calibração). O contrato pede ANONIMIZAR (preservar o sinal sem
 * PII) — refinamento separado. A atual é PII-safe (apaga a mais, nunca vaza).
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
  if (summary.removed.candidate === 0) {
    return Response.json(err("not_found", "candidato não encontrado nesta agência"), {
      status: 404,
    });
  }
  return Response.json(ok(summary), { status: 200 });
}
