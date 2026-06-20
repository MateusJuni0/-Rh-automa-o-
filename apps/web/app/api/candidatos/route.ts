import { err, ok } from "@rh/core";
import { z } from "zod";
import { createCandidato, listCandidatos } from "@/lib/candidatos";
import { extractCvFromFile } from "@/lib/cv-extract";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // unpdf (extração de PDF) precisa do runtime Node.

export async function GET(): Promise<Response> {
  const { agencyId } = await getSession();
  return Response.json(ok(await listCandidatos(getDb(), agencyId)));
}

const jsonSchema = z.object({
  name: z.string().min(1),
  linkedinUrl: z.string().optional(),
  cvText: z.string().min(1),
});

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Criar candidato. Dois caminhos:
 * - `multipart/form-data`: `name` + `cvFile` (PDF — a Vera extrai o texto) E/OU `cvText` colado.
 * - `application/json`: `{ name, cvText }` (comportamento original).
 * O texto (extraído ou colado) alimenta a extração de perfil (`@rh/ai`; stub sem chave).
 */
export async function POST(req: Request): Promise<Response> {
  const { agencyId } = await getSession();
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) {
      return Response.json(err("validation", "formulário inválido"), { status: 400 });
    }
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      return Response.json(err("validation", "nome obrigatório"), { status: 400 });
    }
    let cvText = String(form.get("cvText") ?? "").trim();

    const file = form.get("cvFile");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return Response.json(err("validation", "ficheiro grande demais (máx. 10MB)"), {
          status: 400,
        });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const extracted = await extractCvFromFile({
        bytes,
        filename: file.name,
        mime: file.type,
        agencyId,
      });
      if (!extracted.ok) {
        return Response.json(err("validation", extracted.reason), { status: 400 });
      }
      cvText = extracted.cvText;
    }

    if (cvText.length === 0) {
      return Response.json(err("validation", "anexa um PDF ou cola o texto do CV"), {
        status: 400,
      });
    }
    const res = await createCandidato(getDb(), agencyId, { name, cvText });
    return Response.json(ok(res), { status: 201 });
  }

  const parsed = jsonSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "name e cvText são obrigatórios"), { status: 400 });
  }
  const res = await createCandidato(getDb(), agencyId, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
