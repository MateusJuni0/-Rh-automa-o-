import { err, ok } from "@rh/core";
import { z } from "zod";
import { DEV_AGENCY_ID, getDb } from "@/lib/db";
import { gerarParecer, getParecerMd } from "@/lib/parecer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ interviewId: z.uuid() });

/** Gera (ou re-gera) o parecer de uma entrevista. */
export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "interviewId é obrigatório"), { status: 400 });
  }
  const res = await gerarParecer(getDb(), DEV_AGENCY_ID, parsed.data);
  return Response.json(ok(res), { status: 201 });
}

/** Export markdown do parecer já gerado (?interviewId=...). */
export async function GET(req: Request): Promise<Response> {
  const interviewId = new URL(req.url).searchParams.get("interviewId") ?? "";
  if (!z.uuid().safeParse(interviewId).success) {
    return Response.json(err("validation", "interviewId inválido"), { status: 400 });
  }
  const md = await getParecerMd(getDb(), DEV_AGENCY_ID, interviewId);
  if (md === null) {
    return Response.json(err("not_found", "parecer ainda não gerado"), { status: 404 });
  }
  return new Response(md, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="parecer-${interviewId}.md"`,
    },
  });
}
