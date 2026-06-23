import { err, ok } from "@rh/core";
import { z } from "zod";
import { confirmAction, runMessage } from "@/lib/assistant/run";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.union([
  z.object({ confirmActionId: z.uuid() }),
  z.object({ message: z.string().min(1).max(4000), threadId: z.uuid().optional() }),
]);

/**
 * POST /api/assistant/chat — mensagem nova OU confirmação de uma ação pendente.
 * A PORTA é ENFORÇADA aqui: `confirmAction` é o único caminho que corre uma tool `gravar`/`enviar_fora`.
 */
export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "message ou confirmActionId obrigatório"), {
      status: 400,
    });
  }
  const { agencyId, recruiterId } = await getSession();
  const db = getDb();
  if ("confirmActionId" in parsed.data) {
    try {
      const action = await confirmAction(db, agencyId, recruiterId, parsed.data.confirmActionId);
      return Response.json(ok({ action }), { status: 200 });
    } catch {
      return Response.json(err("not_found", "ação não encontrada ou sem permissão"), {
        status: 404,
      });
    }
  }
  const turn = await runMessage(db, agencyId, recruiterId, {
    message: parsed.data.message,
    threadId: parsed.data.threadId,
  });
  return Response.json(ok(turn), { status: 200 });
}
