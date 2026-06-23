import { err, ok } from "@rh/core";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { importVagaFromLink } from "@/lib/vaga-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // fetch de URL externo (server-side).

const schema = z.object({ url: z.string().min(4).max(2000) });

/**
 * POST /api/vagas/from-link — a Vera vai buscar o texto de uma página de vaga (LinkedIn/site).
 * Devolve o texto + título para pré-preencher o formulário (human-in-loop). NÃO grava nada.
 */
export async function POST(req: Request): Promise<Response> {
  await getSession(); // exige sessão (não é endpoint público).
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "url obrigatório"), { status: 400 });
  }
  const result = await importVagaFromLink(parsed.data.url);
  if (!result.ok) {
    return Response.json(err("validation", result.reason), { status: 400 });
  }
  return Response.json(ok({ text: result.text, title: result.title }));
}
