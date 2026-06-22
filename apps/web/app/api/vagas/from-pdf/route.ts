import { err, ok } from "@rh/core";
import { getSession } from "@/lib/session";
import { importVagaFromPdf } from "@/lib/vaga-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // unpdf (extração de PDF) precisa do runtime Node.

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/vagas/from-pdf — a Vera extrai o texto de um PDF de vaga (multipart, campo `file`).
 * Devolve `{ text, title }` para pré-preencher o formulário (human-in-loop). NÃO grava nada.
 */
export async function POST(req: Request): Promise<Response> {
  const { agencyId } = await getSession(); // exige sessão (não é endpoint público).
  const form = await req.formData().catch(() => null);
  if (!form) {
    return Response.json(err("validation", "formulário inválido"), { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(err("validation", "anexa um PDF"), { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json(err("validation", "ficheiro grande demais (máx. 10MB)"), { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await importVagaFromPdf({
    bytes,
    filename: file.name,
    mime: file.type,
    agencyId,
  });
  if (!result.ok) {
    return Response.json(err("validation", result.reason), { status: 400 });
  }
  return Response.json(ok({ text: result.text, title: result.title }));
}
