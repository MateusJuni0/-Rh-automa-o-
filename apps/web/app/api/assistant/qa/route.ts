import { err, ok } from "@rh/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { answerAboutEntity } from "@/lib/qa/run";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  entityType: z.enum(["candidate", "client"]),
  entityId: z.uuid(),
  question: z.string().min(1).max(2000),
});

/**
 * POST /api/assistant/qa — Q&A factual sobre UMA entidade (candidato/cliente), com prova citada.
 * 100% leitura: NÃO corre tools nem a porta de confirmação (essa fica só no /api/assistant/chat).
 */
export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "entidade ou pergunta inválida"), { status: 400 });
  }
  const { agencyId } = await getSession();
  const db = getDb();
  const answer = await answerAboutEntity(db, agencyId, parsed.data);
  if (!answer) {
    return Response.json(err("not_found", "entidade não encontrada"), { status: 404 });
  }
  return Response.json(ok(answer), { status: 200 });
}
