import { err, ok } from "@rh/core";
import { z } from "zod";
import {
  deleteMemoryFact,
  getMemoryFactById,
  listMemoryFacts,
  MEMORY_FACT_KINDS,
  saveMemoryFact,
} from "@/lib/assistant/memory";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  text: z.string().min(1).max(2000),
  kind: z.enum(MEMORY_FACT_KINDS).optional(),
  sourceRef: z.string().max(120).optional(),
});
const deleteSchema = z.object({ id: z.uuid() });

/** Onboarding (Tela 11): factos duráveis do recrutador. Sempre isolado por agency+recruiter da sessão. */
export async function GET(): Promise<Response> {
  const { agencyId, recruiterId } = await getSession();
  const facts = await listMemoryFacts(getDb(), agencyId, recruiterId, { limit: 100 });
  return Response.json(ok({ facts }), { status: 200 });
}

export async function POST(req: Request): Promise<Response> {
  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "resposta inválida"), { status: 400 });
  }
  const { agencyId, recruiterId } = await getSession();
  const db = getDb();
  const id = await saveMemoryFact(db, agencyId, recruiterId, {
    text: parsed.data.text,
    kind: parsed.data.kind,
    sourceType: "explicit",
    sourceRef: parsed.data.sourceRef,
  });
  // Devolve o facto recém-gravado (pelo id exato → sem corrida, nunca undefined) para o eco "Anotei que…".
  const fact = await getMemoryFactById(db, agencyId, recruiterId, id);
  if (!fact) {
    return Response.json(err("internal", "falha ao gravar o facto"), { status: 500 });
  }
  return Response.json(ok({ id, fact }), { status: 201 });
}

export async function DELETE(req: Request): Promise<Response> {
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "id inválido"), { status: 400 });
  }
  const { agencyId, recruiterId } = await getSession();
  const removed = await deleteMemoryFact(getDb(), agencyId, recruiterId, parsed.data.id);
  if (!removed) {
    return Response.json(err("not_found", "facto não encontrado"), { status: 404 });
  }
  return Response.json(ok({ id: parsed.data.id }), { status: 200 });
}
